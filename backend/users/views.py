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
from tensorflow.keras.models import load_model
from PIL import Image
import numpy as np

# Create your views here.

# Model loader + prediction helper (loads model once)
_ad_model = None

def get_ad_model():
    global _ad_model
    if _ad_model is None:
        model_path = getattr(settings, 'MODEL_PATH', None)
        if not model_path:
            raise RuntimeError("MODEL_PATH not configured in settings.")
        _ad_model = load_model(str(model_path))
    return _ad_model

def predict_ad(image_file):
    """
    image_file: file-like (InMemoryUploadedFile)
    returns: dict { 'label': 'ad'|'no_ad', 'score': float }
    """
    model = get_ad_model()
    # infer target size from model.input_shape if possible
    target_size = (224, 224)
    try:
        inp_shape = model.input_shape  # e.g. (None, height, width, channels)
        if isinstance(inp_shape, (list, tuple)):
            # handle either (None, H, W, C) or (H, W, C)
            if len(inp_shape) == 4:
                _, h, w, _ = inp_shape
                target_size = (w or 224, h or 224)
            elif len(inp_shape) == 3:
                h, w, _ = inp_shape
                target_size = (w or 224, h or 224)
    except Exception:
        target_size = (224, 224)

    img = Image.open(image_file).convert('RGB').resize(target_size)
    x = np.array(img).astype('float32') / 255.0
    x = np.expand_dims(x, 0)

    preds = model.predict(x)
    preds = np.array(preds).squeeze()

    # normalize prediction interpretation:
    if preds.ndim == 0:
        score = float(preds)
    elif preds.size == 1:
        score = float(preds.item())
    elif preds.size == 2:
        # assume binary-class probabilities [no_ad_prob, ad_prob]
        score = float(preds[1])
    else:
        # multiclass: take max probability
        score = float(np.max(preds))

    label = 'ad' if score >= 0.5 else 'no_ad'
    return {'label': label, 'score': score}

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
        for img in images:
            # validate with AdScanSerializer
            ad_check = AdScanSerializer(data={'image': img})
            if not ad_check.is_valid():
                return Response({"error": "Invalid image", "details": ad_check.errors},
                                status=status.HTTP_400_BAD_REQUEST)

            # save to AdScanImage (if desired)
            img_serializer = AdScanImageSerializer(data={'image': img})
            if not img_serializer.is_valid():
                return Response({"error": "Failed to save image", "details": img_serializer.errors},
                                status=status.HTTP_400_BAD_REQUEST)
            try:
                # attach user if serializer/model accepts it; otherwise save without user
                try:
                    instance = img_serializer.save(user=request.user)
                except TypeError:
                    instance = img_serializer.save()
            except Exception as e:
                logger.exception("Saving image failed")
                return Response({"error": "Saving image failed", "details": str(e)},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # run prediction
            try:
                prediction = predict_ad(img)  # file-like object
            except Exception as e:
                logger.exception("Prediction error")
                return Response({"error": "Prediction failed", "details": str(e)},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            results.append({"uploaded": img_serializer.data, "prediction": prediction})

        return Response({"results": results}, status=status.HTTP_201_CREATED)

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

@api_view(["POST"])
@permission_classes([AllowAny])
def chat_view(request):
    """
    Simple chat endpoint used by frontend.
    Expected payload:
      {
        "user_input": "...",
        "previous_state": [...],
        "model_result": [...]
      }
    Returns: { "reply": "..." }
    """
    data = request.data or {}
    user_input = (data.get("user_input") or "").strip()
    model_result = data.get("model_result") or []

    # Build a short summary from model_result if available
    try:
        total = len(model_result)
        ad_count = sum(1 for r in model_result if (r.get("prediction") or {}).get("label") == "ad")
    except Exception:
        total = 0
        ad_count = 0

    if total > 0:
        summary = f"{ad_count} of {total} uploaded image{'s' if total != 1 else ''} show signs of Atopic Dermatitis."
    else:
        summary = "No model results provided."

    # Simple rule-based reply
    if user_input:
        reply = f"I received your message: \"{user_input}\". Current scan summary: {summary}"
    else:
        reply = f"Hello — {summary}"

    return Response({"reply": reply}, status=status.HTTP_200_OK)



