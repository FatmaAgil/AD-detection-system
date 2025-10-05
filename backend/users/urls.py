from django.urls import path
from .views import RegisterView, LoginView, Verify2FAView, CreateAdminView, Resend2FAView, ContactMessageListCreateView
from rest_framework_simplejwt.views import TokenRefreshView
from .views import UserListCreateView, UserRetrieveUpdateDestroyView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("create-admin/", CreateAdminView.as_view(), name="create-admin"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path('verify-2fa/', Verify2FAView.as_view(), name='verify-2fa'),
    path('resend-2fa/', Resend2FAView.as_view(), name='resend-2fa'),
    path('users/', UserListCreateView.as_view(), name='user-list-create'),
    path('users/<int:pk>/', UserRetrieveUpdateDestroyView.as_view(), name='user-detail'),
    path('messages/', ContactMessageListCreateView.as_view(), name='contact-messages'),
]
