from django.urls import path
from .views import RegisterView, LoginView, Verify2FAView, CreateAdminView, Resend2FAView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("create-admin/", CreateAdminView.as_view(), name="create-admin"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path('verify-2fa/', Verify2FAView.as_view(), name='verify-2fa'),
    path('resend-2fa/', Resend2FAView.as_view(), name='resend-2fa'),
]
