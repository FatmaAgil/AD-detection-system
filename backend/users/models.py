from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.postgres.fields import JSONField

class Profile(models.Model):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('general_user', 'General User'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='general_user')

    def __str__(self):
        return f"{self.user.username} - {self.role}"

class Email2FACode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.code}"

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
    instance.profile.save()

class ContactMessage(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.email})"

class MessageReply(models.Model):
    message = models.ForeignKey(ContactMessage, on_delete=models.CASCADE, related_name='replies')
    admin = models.ForeignKey(User, on_delete=models.CASCADE)
    reply_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class AdScanImage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to='adscan_images/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

class Chat(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    messages = models.JSONField(default=list)  # Store list of {sender, text}
    pdf_report = models.FileField(upload_to='chat_reports/', blank=True, null=True)  # PDF file

    def __str__(self):
        return f"Chat {self.id} by {self.user.username}"

class ChatImage(models.Model):
    chat = models.ForeignKey(Chat, related_name="images", on_delete=models.CASCADE)
    file = models.ImageField(upload_to="chat_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
