from django_rest_passwordreset.signals import reset_password_token_created
from django.core.mail import send_mail
from django.conf import settings


def password_reset_token_created(sender, instance, reset_password_token, *args, **kwargs):
    send_mail(
        "Password Reset",
        f"Use this token to reset your password: {reset_password_token.key}",
        settings.DEFAULT_FROM_EMAIL,
        [reset_password_token.user.email]
    )


# Connect the signal
reset_password_token_created.connect(password_reset_token_created)
