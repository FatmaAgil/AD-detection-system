import random
from django.core.mail import send_mail
from .models import Email2FACode
from django.conf import settings
from tensorflow.keras.models import load_model
from PIL import Image
import numpy as np

_model = None

def get_model():
    global _model
    if _model is None:
        _model = load_model(str(settings.MODEL_PATH))
    return _model

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

def predict_ad(image_file):
    """
    image_file: InMemoryUploadedFile or file-like object
    returns: {'label': 'ad'|'no_ad', 'score': float}
    """
    model = get_model()
    # try to infer required input size from model; fallback to 224x224
    try:
        _, h, w, _ = model.input_shape
        target_size = (w, h)
    except Exception:
        target_size = (224, 224)

    img = Image.open(image_file).convert('RGB').resize(target_size)
    x = np.array(img).astype('float32') / 255.0
    x = np.expand_dims(x, 0)

    preds = model.predict(x)[0]

    # handle a few possible model output shapes
    if hasattr(preds, 'shape') and preds.shape == ():
        score = float(preds)
    elif preds.size == 1:
        score = float(preds[0])
    else:
        # assume class probabilities; pick the index with max prob
        idx = int(np.argmax(preds))
        score = float(preds[idx])

    # Adjust threshold/label mapping to match your model
    label = 'ad' if score >= 0.5 else 'no_ad'
    return {'label': label, 'score': score}