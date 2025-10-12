from django.shortcuts import render
from rest_framework import generics
from django.contrib.auth.models import User
from .serializers import UserSerializer, ContactMessageSerializer, MessageReplySerializer, AdScanImageSerializer
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

# Create your views here.

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
            return Response({'message': '2FA code sent to your email.', 'user_id': user.id, 'role': role}, status=status.HTTP_200_OK)
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
                tokens = get_tokens_for_user(user)  # <-- Generate JWT tokens
                return Response({
                    'message': '2FA verified!',
                    'role': user.profile.role,
                    'access': tokens['access'],
                    'refresh': tokens['refresh'],
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
    permission_classes = [IsAuthenticated]

    def post(self, request):
        images = request.FILES.getlist('images')
        if len(images) > 10:
            return Response({"error": "You can upload up to 10 images."}, status=400)
        saved = []
        for img in images:
            serializer = AdScanImageSerializer(data={'image': img})
            if serializer.is_valid():
                serializer.save(user=request.user)
                saved.append(serializer.data)
            else:
                return Response(serializer.errors, status=400)
        return Response({"uploaded": saved}, status=201)

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }



