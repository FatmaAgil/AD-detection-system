from django.urls import path
from .views import admin_stats, RegisterView, LoginView, Verify2FAView, CreateAdminView, Resend2FAView, ContactMessageListCreateView, UserProfileView, UserContactMessagesView, AdScanImageUploadView, AdScanAPIView, universal_symptom_assessment, ChatListCreateView, ChatRetrieveUpdateDestroyView, diagnose_model_issue, model_health_check, debug_model_performance
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
    path('api/adscan/', AdScanAPIView.as_view(), name='adscan-single'),
    path('universal-assessment/', universal_symptom_assessment, name='universal-assessment'),
    path("admin/stats/", admin_stats, name="admin-stats"),
    path('chats/', ChatListCreateView.as_view(), name='chat-list-create'),
    path('chats/<int:pk>/', ChatRetrieveUpdateDestroyView.as_view(), name='chat-detail'),
    path('api/model-diagnose/', diagnose_model_issue, name='model-diagnose'),
    path('api/model-health/', model_health_check, name='model-health'),
    path('api/debug-model/', debug_model_performance, name='debug-model'),
]
