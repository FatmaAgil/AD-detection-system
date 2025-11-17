from django.shortcuts import render
from rest_framework import generics
from django.contrib.auth.models import User
from .serializers import UserSerializer, ContactMessageSerializer, MessageReplySerializer, AdScanImageSerializer, AdScanSerializer
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .models import Email2FACode, ContactMessage, MessageReply
import random
from django.core.mail import send_mail
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated  # or AllowAny for public

# new imports for model connection and prediction
from django.conf import settings
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input #type: ignore
from tensorflow.keras.models import load_model #type: ignore
from PIL import Image
import numpy as np

# Create your views here.

# ============================================================
# Model loader + prediction helper (loads model once)
# ============================================================
_ad_model = None

def get_ad_model():
    global _ad_model
    if _ad_model is None:
        model_path = getattr(settings, 'MODEL_PATH', None)
        if not model_path:
            raise RuntimeError("MODEL_PATH not configured in settings.")
        _ad_model = load_model(str(model_path))
    return _ad_model

# ============================================================
# Corrected prediction function for new .keras model
# ============================================================
def predict_ad(image_file):
    """
    image_file: file-like (InMemoryUploadedFile)
    returns: dict { 'label': 'ad'|'not_ad', 'score': float, 'confidence': float, 'raw_probability': float }
    """
    model = get_ad_model()
    target_size = (224, 224)  # adjust to your training input size

    # Load and preprocess image
    img = Image.open(image_file).convert('RGB').resize(target_size)
    x = np.array(img).astype('float32') / 255.0  # normalize 0-1
    x = np.expand_dims(x, 0)  # add batch dimension

    # Predict
    raw_probability = float(model.predict(x, verbose=0)[0][0])

    # Corrected logic: inverted labels
    is_ad = raw_probability < 0.31
    # return lowercase label that frontend/chat logic expects
    label = "ad" if is_ad else "not_ad"
    confidence = (1 - raw_probability) if is_ad else raw_probability
    score = float(confidence)  # frontend expects `prediction.score` in 0..1

    return {
        "label": label,
        "score": score,
        "confidence": float(confidence),    # kept for backward compatibility
        "is_atopic_dermatitis": bool(is_ad),
        "raw_probability": float(raw_probability)
    }
# Signup API
class RegisterView(APIView):
    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        password2 = request.data.get('password2')
        if password != password2:
            return Response({'detail': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, email=email, password=password)
        user.profile.role = 'general_user'
        user.profile.save()
        return Response({'message': 'User registered successfully'}, status=status.HTTP_201_CREATED)

# Login API (using JWT)
class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if user:
            code = str(random.randint(100000, 999999))
            Email2FACode.objects.create(user=user, code=code)
            send_mail(
                'Your 2FA Code',
                f'Your 2FA code is: {code}',
                None,
                [user.email],
                fail_silently=False,
            )
            # Ensure profile exists
            if not hasattr(user, 'profile'):
                from .models import Profile
                Profile.objects.create(user=user)
            role = user.profile.role
            return Response({
                'message': '2FA code sent to your email.',
                'user_id': user.id,
                'role': role,
                'username': user.username,  # <-- Add this line
            }, status=status.HTTP_200_OK)
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

class Verify2FAView(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        code = request.data.get('code')
        try:
            user = User.objects.get(id=user_id)
            code_obj = Email2FACode.objects.filter(user=user, code=code).order_by('-created_at').first()
            if code_obj:
                Email2FACode.objects.filter(user=user).delete()
                tokens = get_tokens_for_user(user)
                return Response({
                    'message': '2FA verified!',
                    'role': user.profile.role,
                    'access': tokens['access'],
                    'refresh': tokens['refresh'],
                    'username': user.username,  # <-- Add this line
                }, status=status.HTTP_200_OK)
            else:
                return Response({'detail': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

class CreateAdminView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.profile.role == 'admin':
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, email=email, password=password)
        user.profile.role = 'admin'
        user.profile.save()
        return Response({'message': 'Admin created successfully'}, status=status.HTTP_201_CREATED)

class Resend2FAView(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'User ID required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
            # Optionally delete old codes
            Email2FACode.objects.filter(user=user).delete()
            code = str(random.randint(100000, 999999))
            Email2FACode.objects.create(user=user, code=code)
            send_mail(
                'Your 2FA Code',
                f'Your new 2FA code is: {code}',
                None,
                [user.email],
                fail_silently=False,
            )
            return Response({'message': '2FA code resent.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class UserRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class ContactMessageListCreateView(generics.ListCreateAPIView):
    queryset = ContactMessage.objects.all().order_by('-created_at')
    serializer_class = ContactMessageSerializer

class MessageReplyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # Optionally, check for admin:
        # if not request.user.is_staff:
        #     return Response({"detail": "Admins only."}, status=403)
        serializer = MessageReplySerializer(data={
            'message': pk,
            'admin': request.user.id,
            'reply_text': request.data.get('reply_text')
        })
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class ContactMessageUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [IsAuthenticated]

class MessageReplyUpdateView(generics.RetrieveUpdateAPIView):
    queryset = MessageReply.objects.all()
    serializer_class = MessageReplySerializer
    permission_classes = [IsAuthenticated]

    def put(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class UserContactMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        messages = ContactMessage.objects.filter(email=request.user.email).order_by('-created_at')
        serializer = ContactMessageSerializer(messages, many=True)
        return Response(serializer.data)

class AdScanImageUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    # for testing set AllowAny; change back to IsAuthenticated once verified
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        logger = logging.getLogger(__name__)
        logger.debug("AdScan upload - FILES: %s", request.FILES)
        logger.debug("AdScan upload - DATA: %s", request.data)

        # accept multiple files under 'images' or a single file under 'image'
        images = request.FILES.getlist('images')
        if not images:
            single = request.FILES.get('image')
            if single:
                images = [single]
            else:
                return Response(
                    {"error": "No images uploaded. Use form field 'images' (multiple) or 'image' (single)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        results = []
        errors = []
        for idx, img in enumerate(images, start=1):
            # validate with AdScanSerializer
            ad_check = AdScanSerializer(data={'image': img})
            if not ad_check.is_valid():
                errors.append({
                    "index": idx,
                    "filename": getattr(img, "name", f"image-{idx}"),
                    "error": "Invalid image",
                    "details": ad_check.errors
                })
                # skip this file, continue with others
                continue

            # save to AdScanImage (if desired)
            img_serializer = AdScanImageSerializer(data={'image': img})
            if not img_serializer.is_valid():
                errors.append({
                    "index": idx,
                    "filename": getattr(img, "name", f"image-{idx}"),
                    "error": "Failed to save image",
                    "details": img_serializer.errors
                })
                continue

            try:
                # attach user if serializer/model accepts it; otherwise save without user
                try:
                    instance = img_serializer.save(user=request.user)
                except TypeError:
                    instance = img_serializer.save()
            except Exception as e:
                logger.exception("Saving image failed")
                errors.append({
                    "index": idx,
                    "filename": getattr(img, "name", f"image-{idx}"),
                    "error": "Saving image failed",
                    "details": str(e)
                })
                continue

            # run prediction
            try:
                prediction = predict_ad(img)  # file-like object
            except Exception as e:
                logger.exception("Prediction error")
                errors.append({
                    "index": idx,
                    "filename": getattr(img, "name", f"image-{idx}"),
                    "error": "Prediction failed",
                    "details": str(e)
                })
                continue

            results.append({
                "index": idx,
                "filename": getattr(img, "name", f"image-{idx}"),
                "uploaded": img_serializer.data,
                "prediction": prediction
            })

        # If there were errors, return them alongside results so frontend can show exactly which files failed.
        response_payload = {"results": results, "errors": errors}
        if errors:
            return Response(response_payload, status=status.HTTP_207_MULTI_STATUS)
        return Response(response_payload, status=status.HTTP_201_CREATED)

# Add an API view that accepts one image and returns prediction
class AdScanAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]  # change to AllowAny if you want public access

    def post(self, request):
        serializer = AdScanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        image = serializer.validated_data['image']
        try:
            result = predict_ad(image)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

# Admin dashboard stats view
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_stats(request):
    """
    Return minimal stats for admin dashboard.
    """
    user_count = User.objects.count()
    return Response({"user_count": user_count})

AD_QUESTIONS = [
    "Is the affected area itchy?",
    "Do you notice redness or inflammation?",
    "Is there any oozing or crusting?",
    "Does it occur in skin folds (elbows, knees, wrists)?",
    "Is there a history of eczema or allergies?",
]

@api_view(["POST"])
@permission_classes([AllowAny])
def chat_view(request):
    logger = logging.getLogger(__name__)
    data = request.data or {}
    user_input = (data.get("user_input") or "").strip()
    previous_state = data.get("previous_state") or []
    model_result = data.get("model_result") or []

    # DEBUG: log incoming chat payload (inspect server console)
    logger.debug("chat_view: user_input=%r", user_input)
    logger.debug("chat_view: previous_state (len=%d) = %s", len(previous_state), previous_state)
    logger.debug("chat_view: model_result = %s", model_result)

    # Summarize scan results
    total = len(model_result)
    ad_count = sum(1 for r in model_result if r.get("prediction", {}).get("label") == "ad")
    summary = (
        f"{ad_count} of {total} uploaded image{'s' if total != 1 else ''} show signs of Atopic Dermatitis."
        if total > 0 else "No scan results available."
    )

    # Robustly pair AI questions with user answers.
    # Strategy:
    # 1) Walk previous_state, map each AI question to the next user message (if any).
    # 2) If no user reply is found in previous_state for the last AI question,
    #    use the current request's user_input as that answer (handles frontend timing).
    answers = {}
    last_ai_question = None
    # compare questions case-insensitive
    normalized_questions = [q.strip().lower() for q in AD_QUESTIONS]

    for msg in previous_state:
        sender = (msg.get("sender") or "").strip().lower()
        text = (msg.get("text") or "").strip()
        if sender == "ai" and text.lower() in normalized_questions:
            last_ai_question = text  # keep original text form as key
            continue
        if sender == "user" and last_ai_question:
            if last_ai_question not in answers and text != "":
                answers[last_ai_question] = text.lower()
            last_ai_question = None

    # If the frontend didn't include the latest user reply in previous_state (race),
    # treat the current user_input as the answer to the most recent AI question.
    if last_ai_question and last_ai_question not in answers and user_input:
        answers[last_ai_question] = user_input.lower()

    # Determine next unanswered question (use original AD_QUESTIONS ordering)
    next_question = None
    for q in AD_QUESTIONS:
        if q not in answers:
            next_question = q
            break

    # Build AI reply text
    if not previous_state:
        reply = f"Hello — {summary}"
    else:
        reply = f"I received your message: \"{user_input}\". {summary}"
        if next_question is None:
            reply += " All questions completed."

    # Normalize common affirmative/negative variants
    def normalize_yes_no(t):
        if not t:
            return None
        v = t.strip().lower()
        if v in ("yes", "y", "yeah", "yep", "true", "1"):
            return True
        if v in ("no", "n", "nope", "nah", "false", "0"):
            return False
        return None

    normalized = {q: normalize_yes_no(a) for q, a in answers.items()}
    total_answered = sum(1 for v in normalized.values() if v is not None)
    yes_count = sum(1 for v in normalized.values() if v is True)
    risk_estimate = (yes_count / total_answered) if total_answered > 0 else 0.0

    return Response({
        "reply": reply,
        "next_question": next_question,
        "risk_estimate": float(risk_estimate)
    })