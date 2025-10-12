from django.urls import path
from .views import RegisterView, LoginView, Verify2FAView, CreateAdminView, Resend2FAView, ContactMessageListCreateView, UserProfileView, UserContactMessagesView, AdScanImageUploadView
from rest_framework_simplejwt.views import TokenRefreshView
from .views import UserListCreateView, UserRetrieveUpdateDestroyView, MessageReplyListCreateView, ContactMessageUpdateDeleteView, MessageReplyUpdateView

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
    path('messages/<int:pk>/reply/', MessageReplyListCreateView.as_view(), name='message-reply'),
    path('messages/<int:pk>/', ContactMessageUpdateDeleteView.as_view(), name='message-edit-delete'),
    path('replies/<int:pk>/', MessageReplyUpdateView.as_view(), name='reply-update'),
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    path("my-messages/", UserContactMessagesView.as_view(), name="user-contact-messages"),
    path("adscan/upload/", AdScanImageUploadView.as_view(), name="adscan-upload"),
]
