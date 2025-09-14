import random
from django.core.mail import send_mail
from .models import Email2FACode

def generate_2fa_code(user):
    code = str(random.randint(100000, 999999))
    Email2FACode.objects.create(user=user, code=code)
    send_mail(
        'Your 2FA Code',
        f'Your 2FA code is: {code}',
        None,  # Uses DEFAULT_FROM_EMAIL
        [user.email],
        fail_silently=False,
    )
    return code