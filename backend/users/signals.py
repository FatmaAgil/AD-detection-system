from django_rest_passwordreset.signals import reset_password_token_created
from django.core.mail import send_mail
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Profile


def password_reset_token_created(sender, instance, reset_password_token, *args, **kwargs):
    send_mail(
        "Password Reset",
        f"Use this token to reset your password: {reset_password_token.key}",
        settings.DEFAULT_FROM_EMAIL,
        [reset_password_token.user.email]
    )


@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    role = 'admin' if instance.is_staff else 'general_user'
    profile, profile_created = Profile.objects.get_or_create(user=instance, defaults={'role': role})
    # If the profile already exists, update the role if needed
    if not profile_created and profile.role != role:
        profile.role = role
        profile.save()


# Connect the signal
reset_password_token_created.connect(password_reset_token_created)
