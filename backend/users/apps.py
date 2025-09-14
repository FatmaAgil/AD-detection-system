from django.apps import AppConfig
from . import signals

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

def ready(self):
        import users.signals  # 👈 this ensures signals get registered at startup