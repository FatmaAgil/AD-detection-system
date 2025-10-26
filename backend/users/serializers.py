from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import ContactMessage, MessageReply, AdScanImage
from django.conf import settings

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "password2", "is_staff")

    def validate(self, attrs):
        if self.instance is None:  # Only check on create
            if attrs.get("password") != attrs.get("password2"):
                raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        validated_data.pop("password2", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        password2 = validated_data.pop('password2', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            if password != password2:
                raise serializers.ValidationError({"password2": "Passwords do not match."})
            validate_password(password)
            instance.set_password(password)
        instance.save()
        return instance

class MessageReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageReply
        fields = ['id', 'reply_text', 'admin', 'message', 'created_at']
        extra_kwargs = {
            'admin': {'required': False},
            'message': {'required': False},
        }

class ContactMessageSerializer(serializers.ModelSerializer):
    replies = MessageReplySerializer(many=True, read_only=True)

    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'message', 'created_at', 'replies']

class AdScanImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdScanImage
        fields = ['id', 'image', 'uploaded_at']

class AdScanSerializer(serializers.Serializer):
    """
    Simple serializer for image uploads used by the ad-scan API.

    Validations:
    - file type limited to jpeg/jpg/png
    - configurable max size via settings.ADSCAN_MAX_UPLOAD_BYTES (defaults to 5 MB)
    """
    image = serializers.ImageField()

    def validate_image(self, value):
        # max size (bytes)
        max_bytes = getattr(settings, 'ADSCAN_MAX_UPLOAD_BYTES', 5 * 1024 * 1024)
        if value.size > max_bytes:
            mb = max_bytes // (1024 * 1024)
            raise serializers.ValidationError(f'Image too large. Max size is {mb} MB.')

        # content type check (some file storages may not set content_type)
        content_type = getattr(value, 'content_type', None)
        if content_type:
            main, _, sub = content_type.partition('/')
            allowed = {'jpeg', 'jpg', 'png'}
            if main != 'image' or sub.lower() not in allowed:
                raise serializers.ValidationError('Invalid image type. Allowed types: jpeg, png.')

        return value
