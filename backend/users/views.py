from django.shortcuts import render
from rest_framework import generics
from django.contrib.auth.models import User
from .serializers import UserSerializer, ContactMessageSerializer, MessageReplySerializer, AdScanImageSerializer, AdScanSerializer
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .models import Email2FACode, ContactMessage, MessageReply, AdScanImage, Chat  # Ensure AdScanImage is included here
import random
from django.core.mail import send_mail
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication
import logging
import time  # <-- add this import
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

# new imports for model connection and prediction
from django.conf import settings
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input  # type: ignore
from tensorflow.keras.models import load_model  # type: ignore
from PIL import Image, ImageOps
import numpy as np
import joblib
import tempfile
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from django.core.files.base import ContentFile
import io
from .models import Chat
from .serializers import ChatSerializer
from django.http import FileResponse  # <-- added FileResponse import

# Create your views here.

# ============================================================
# Model loaders for BOTH models (light and dark skin)
# ============================================================
_ad_model_light = None
_ad_model_dark = None

def get_ad_model_light():
    global _ad_model_light
    if _ad_model_light is None:
        model_path = getattr(settings, 'MODEL_PATH_LIGHT', None)
        if not model_path:
            raise RuntimeError("MODEL_PATH_LIGHT not configured in settings.")
        _ad_model_light = load_model(str(model_path))
        print("✅ Light skin model loaded successfully")
    return _ad_model_light

def get_ad_model_dark():
    global _ad_model_dark
    if _ad_model_dark is None:
        model_path = getattr(settings, 'MODEL_PATH_DARK', None)
        if not model_path:
            raise RuntimeError("MODEL_PATH_DARK not configured in settings.")
        
        # Load the deployable model (joblib serialized)
        _ad_model_dark = joblib.load(str(model_path))
        print("✅ Dark skin model (deployable) loaded successfully")
        
        # CRITICAL FIX: Inject a robust predict_single_image wrapper that ensures PIL/numpy are used
        if hasattr(_ad_model_dark, 'predict_single_image'):
            from PIL import Image as PILImage, ImageOps as PILImageOps
            import numpy as _np
            import os

            original_predict = _ad_model_dark.predict_single_image

            def fixed_predict_single_image(image_path, use_hybrid=True):
                try:
                    # Preprocess exactly like Colab / app expectations
                    img = PILImage.open(image_path).convert('RGB')
                    img = PILImageOps.fit(img, (224, 224), PILImage.BILINEAR)
                    img_array = _np.array(img).astype('float32') / 255.0
                    img_array_expanded = _np.expand_dims(img_array, axis=0)

                    # Hybrid path if model exposes feature_extractor + classifier
                    if use_hybrid and hasattr(_ad_model_dark, 'feature_extractor') and hasattr(_ad_model_dark, 'classifier'):
                        try:
                            features = _ad_model_dark.feature_extractor.predict(img_array_expanded, verbose=0)
                            features_flat = features.reshape(features.shape[0], -1)
                            # classifier may be sklearn-like with predict_proba
                            if hasattr(_ad_model_dark.classifier, 'predict_proba'):
                                prob = float(_ad_model_dark.classifier.predict_proba(features_flat)[0][1])
                            else:
                                prob = float(_ad_model_dark.classifier.predict(features_flat)[0])
                            prediction = "AD" if prob > getattr(_ad_model_dark, 'optimal_threshold', 0.5) else "Not AD"
                            model_used = "Hybrid"
                        except Exception as e_feat:
                            # fallback to original predict if hybrid step fails
                            try:
                                raw = original_predict(image_path, use_hybrid=use_hybrid)
                                if isinstance(raw, dict) and raw.get('probability') is not None:
                                    prob = float(raw.get('probability', 0.5))
                                    prediction = raw.get('prediction', 'Error')
                                else:
                                    prob = 0.5
                                    prediction = "Error"
                                model_used = raw.get('model_used', 'Original')
                            except Exception:
                                prob = 0.5
                                prediction = "Error"
                                model_used = "Error"
                    else:
                        # Original model path: try to use known attribute original_model or fall back to original_predict
                        if hasattr(_ad_model_dark, 'original_model'):
                            try:
                                pred = _ad_model_dark.original_model.predict(img_array_expanded, verbose=0)
                                # handle nested array outputs
                                if hasattr(pred, '__len__') and len(pred) > 0:
                                    p0 = pred[0]
                                    prob = float(p0[0]) if (hasattr(p0, '__len__') and len(p0) > 0) else float(p0)
                                else:
                                    prob = float(pred)
                                prediction = "AD" if prob > 0.5 else "Not AD"
                                model_used = "Original"
                            except Exception:
                                try:
                                    raw = original_predict(image_path, use_hybrid=use_hybrid)
                                    if isinstance(raw, dict) and raw.get('probability') is not None:
                                        prob = float(raw.get('probability', 0.5))
                                        prediction = raw.get('prediction', 'Error')
                                    else:
                                        prob = 0.5
                                        prediction = "Error"
                                    model_used = raw.get('model_used', 'Original')
                                except Exception:
                                    prob = 0.5
                                    prediction = "Error"
                                    model_used = "Error"
                        else:
                            # fallback: call original_predict and interpret dict / numeric results
                            try:
                                raw = original_predict(image_path, use_hybrid=use_hybrid)
                                if isinstance(raw, dict):
                                    prob = float(raw.get('probability', raw.get('prob', 0.5)))
                                    prediction = raw.get('prediction', 'Error')
                                    model_used = raw.get('model_used', 'Original')
                                elif hasattr(raw, '__float__'):
                                    prob = float(raw)
                                    prediction = "AD" if prob > 0.5 else "Not AD"
                                    model_used = "Original"
                                else:
                                    prob = 0.5
                                    prediction = "Error"
                                    model_used = "Original"
                            except Exception:
                                prob = 0.5
                                prediction = "Error"
                                model_used = "Error"

                    return {
                        'prediction': prediction,
                        'probability': float(prob),
                        'confidence': 'High' if abs(prob - 0.5) > 0.3 else 'Medium',
                        'model_used': model_used,
                        'threshold_used': getattr(_ad_model_dark, 'optimal_threshold', (0.3 if use_hybrid else 0.5)),
                        'success': True
                    }

                except Exception as e:
                    return {
                        'prediction': 'Error',
                        'probability': 0.5,
                        'confidence': 'Unknown',
                        'model_used': 'Error',
                        'error': str(e),
                        'success': False
                    }

            # Replace the method with our fixed version
            try:
                _ad_model_dark.predict_single_image = fixed_predict_single_image
                print("🎯 Fixed predict_single_image method with proper imports and fallbacks")
            except Exception as e_set:
                print("⚠️ Failed to replace predict_single_image:", e_set)
            
    return _ad_model_dark

# ============================================================
# UPDATED Prediction functions with consistent preprocessing
# ============================================================
def predict_ad_light(image_file):
    """
    Original model for light skin tones - FIXED with consistent preprocessing
    """
    model = get_ad_model_light()
    target_size = (224, 224)

    try:
        # Reset file pointer
        if hasattr(image_file, 'seek'):
            image_file.seek(0)
            
        # Use EXACTLY the same preprocessing as Colab
        img = Image.open(image_file).convert('RGB')
        img = ImageOps.fit(img, target_size, Image.BILINEAR)  # Same as Colab
        x = np.array(img).astype('float32') / 255.0           # Same as Colab
        x = np.expand_dims(x, 0)

        # Predict
        raw_probability = float(model.predict(x, verbose=0)[0][0])

        # Your existing logic (kept)
        is_ad = raw_probability < 0.31
        label = "ad" if is_ad else "not_ad"
        confidence = (1 - raw_probability) if is_ad else raw_probability

        return {
            "label": label,
            "score": float(confidence),
            "confidence": float(confidence),
            "is_atopic_dermatitis": bool(is_ad),
            "raw_probability": float(raw_probability),
            "model_used": "General Model (Light Skin Optimized)"
        }
    except Exception as e:
        print(f"❌ Error in predict_ad_light: {e}")
        raise

def predict_ad_dark(image_file):
    """
    Deployable model for dark skin tones - FIXED to match Colab preprocessing
    """
    model = get_ad_model_dark()
    
    tmp_path = None
    try:
        # Step 1: Use EXACTLY the same preprocessing as in Colab
        img = Image.open(image_file).convert('RGB')
        
        # CRITICAL FIX: Use the same ImageOps.fit as in Colab
        img = ImageOps.fit(img, (224, 224), Image.BILINEAR)  # Must match Colab
        
        # Save to temp file with proper preprocessing
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            img.save(tmp_file, format='JPEG', quality=95)
            tmp_path = tmp_file.name
        
        # Debug info
        print(f"🖼️  Preprocessed image: {img.size}, mode: {img.mode}")
        print(f"📁 Temp path: {tmp_path}")
        
        # Step 2: Call the model (matches your Colab deployable model)
        # NOTE: some deployable models execute code that expects "Image" to exist in globals
        # (e.g. using PIL.Image as Image without importing). Retry with a small injection
        # if that specific NameError appears in the returned result.
        result = None
        try:
            result = model.predict_single_image(tmp_path, use_hybrid=True)
        except Exception as e:
            # If the model raises directly, capture for retry below
            result = {"error": str(e), "prediction": "Error", "probability": 0.5, "confidence": "Unknown", "model_used": "Error", "success": False}
            print(f"⚠️ predict_single_image threw exception: {e}")

        # If model returned an error mentioning missing 'Image', attempt a targeted retry
        needs_injection = False
        if isinstance(result, dict):
            err = str(result.get("error") or "")
            if "name 'Image' is not defined" in err or "NameError: Image" in err:
                needs_injection = True

        if needs_injection:
            # Inject PIL.Image as "Image" into builtins for the duration of the call
            import builtins
            from PIL import Image as PILImage
            had_image = hasattr(builtins, 'Image')
            old_image = getattr(builtins, 'Image', None)
            builtins.Image = PILImage
            try:
                print("🔧 Injected PIL.Image as 'Image' into builtins and retrying predict_single_image()")
                try:
                    result = model.predict_single_image(tmp_path, use_hybrid=True)
                except Exception as e2:
                    # keep the exception info in result for downstream logging
                    print(f"⚠️ Retry also failed: {e2}")
                    result = {"error": str(e2), "prediction": "Error", "probability": 0.5, "confidence": "Unknown", "model_used": "Error", "success": False}
            finally:
                # restore builtins.Image to previous state
                if had_image:
                    builtins.Image = old_image
                else:
                    try:
                        delattr(builtins, 'Image')
                    except Exception:
                        pass

        # Final fallback: if result still indicates error, try calling without use_hybrid
        if isinstance(result, dict) and result.get("success") is False and "error" in result:
            try:
                print("🔁 Fallback: calling predict_single_image without use_hybrid")
                result = model.predict_single_image(tmp_path)
            except Exception as e3:
                print(f"❌ Final fallback failed: {e3}")
                # keep previous result; do not raise here to preserve behavior
                result = result if result is not None else {"error": str(e3), "prediction": "Error", "probability": 0.5, "confidence": "Unknown", "model_used": "Error", "success": False}

        # Debug: Log full result
        print(f"📊 Full result: {result}")
        
        # Extract probability - handle different result structures
        if isinstance(result, dict):
            prob = float(result.get("probability", 0.5))
            prediction_label = result.get("prediction", "")
            confidence_level = result.get("confidence", "Medium")
        else:
            # Fallback if result is not a dictionary
            prob = float(result) if hasattr(result, '__float__') else 0.5
            prediction_label = "AD" if prob > 0.5 else "Not AD"
            confidence_level = "Medium"
        
        print(f"📊 Extracted probability: {prob}")
        
        # Use the optimal threshold from your tested model
        OPTIMAL_THRESHOLD = 0.3  # From your Colab testing
        
        # Determine final prediction
        is_ad = prob >= OPTIMAL_THRESHOLD
        label = "ad" if is_ad else "not_ad"
        
        print(f"🎯 Final: label={label}, is_ad={is_ad}, threshold={OPTIMAL_THRESHOLD}")
        
        return {
            "label": label,
            "score": float(prob),
            "confidence": float(prob),
            "is_atopic_dermatitis": bool(is_ad),
            "raw_probability": float(prob),
            "model_used": "Dark Skin Optimized Model (Deployable)",
            "confidence_level": confidence_level,
            "threshold_used": OPTIMAL_THRESHOLD
        }

    except Exception as e:
        print(f"❌ Error in predict_ad_dark: {e}")
        import traceback
        print(f"🔍 Full traceback: {traceback.format_exc()}")
        raise
    finally:
        # Cleanup
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass

# ============================================================
# FIXED dark-model wrapper (non-destructive retries, robust parsing)
# ============================================================
def predict_ad_dark_fixed(image_file):
    """
    Safer wrapper around the deployable dark-skin model with enhanced debug logging.
    """
    import inspect
    model = get_ad_model_dark()
    tmp_path = None
    try:
        # Preprocess exactly like Colab
        if hasattr(image_file, 'seek'):
            image_file.seek(0)
        img = Image.open(image_file).convert('RGB')
        img = ImageOps.fit(img, (224, 224), Image.BILINEAR)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            img.save(tmp_file, format='JPEG', quality=95)
            tmp_path = tmp_file.name

        print(f"🖼️  Preprocessed image saved to: {tmp_path} (size={img.size})")

        # Inspect predict_single_image signature for debugging
        pred_fn = getattr(model, 'predict_single_image', None)
        try:
            sig = inspect.signature(pred_fn) if pred_fn is not None else None
        except Exception as _:
            sig = None
        print(f"🔍 predict_single_image exists: {pred_fn is not None}, signature: {sig}")

        # Try primary call (use_hybrid True first, then fallback), logging raw outputs
        result = None
        try:
            print("▶️ Calling predict_single_image(..., use_hybrid=True)")
            result = model.predict_single_image(tmp_path, use_hybrid=True)
            print(f"✅ Raw result (use_hybrid=True): type={type(result)}, value={result}")
            if isinstance(result, dict):
                print(f"   keys: {list(result.keys())}")
        except Exception as e:
            print(f"⚠️ predict_single_image(use_hybrid=True) raised: {e}")

            # Try targeted NameError fix by injecting PIL.Image into builtins
            err_text = str(e)
            if "name 'Image' is not defined" in err_text or "NameError: Image" in err_text:
                from PIL import Image as PILImage
                had_image = hasattr(builtins, 'Image')
                old_image = getattr(builtins, 'Image', None)
                builtins.Image = PILImage
                try:
                    print("🔧 Injected PIL.Image into builtins and retrying predict_single_image(use_hybrid=True)")
                    try:
                        result = model.predict_single_image(tmp_path, use_hybrid=True)
                        print(f"✅ Raw result after injection: type={type(result)}, value={result}")
                        if isinstance(result, dict):
                            print(f"   keys: {list(result.keys())}")
                    except Exception as e2:
                        print(f"⚠️ Retry after injecting Image failed: {e2}")
                finally:
                    if had_image:
                        builtins.Image = old_image
                    else:
                        try:
                            delattr(builtins, 'Image')
                        except Exception:
                            pass

        # Final fallback: try without use_hybrid if earlier attempts reported failure or no usable result
        need_fallback = result is None or (isinstance(result, dict) and result.get('success') is False)
        if need_fallback:
            try:
                print("🔁 Fallback: calling predict_single_image(tmp_path) without use_hybrid")
                result = model.predict_single_image(tmp_path)
                print(f"✅ Raw result (no use_hybrid): type={type(result)}, value={result}")
                if isinstance(result, dict):
                    print(f"   keys: {list(result.keys())}")
            except Exception as e3:
                print(f"❌ Fallback without use_hybrid failed: {e3}")

        # Robust probability extraction (same as before), but log chosen value
        prob = 0.5
        confidence_level = "Medium"
        if isinstance(result, dict):
            for key in ('probability', 'prob', 'score', 'confidence'):
                if key in result and result.get(key) is not None:
                    try:
                        prob = float(result.get(key))
                        print(f"🔎 Extracted prob from key '{key}': {prob}")
                        break
                    except Exception:
                        continue
            confidence_level = result.get('confidence', confidence_level)
        else:
            try:
                prob = float(result)
                print(f"🔎 Extracted prob from numeric result: {prob}")
            except Exception:
                print("⚠️ Could not extract probability from raw result; using default 0.5")

        OPTIMAL_THRESHOLD = 0.3
        is_ad = prob >= OPTIMAL_THRESHOLD
        label = "ad" if is_ad else "not_ad"

        print(f"🎯 Final: label={label}, is_ad={is_ad}, prob={prob}, threshold={OPTIMAL_THRESHOLD}")

        return {
            "label": label,
            "score": float(prob),
            "confidence": float(prob),
            "is_atopic_dermatitis": bool(is_ad),
            "raw_probability": float(prob),
            "model_used": "Dark Skin Optimized Model (Deployable)",
            "confidence_level": confidence_level,
            "threshold_used": OPTIMAL_THRESHOLD,
            "success": False if (isinstance(result, dict) and result.get("success") is False) else True,
            "raw_result": result
        }

    except Exception as e:
        import traceback
        print(f"❌ Critical error in predict_ad_dark_fixed: {e}")
        print(traceback.format_exc())
        return {
            "label": "not_ad",
            "score": 0.5,
            "confidence": 0.5,
            "is_atopic_dermatitis": False,
            "raw_probability": 0.5,
            "model_used": "Dark Skin Optimized Model (Error Fallback)",
            "confidence_level": "Low",
            "threshold_used": 0.3,
            "success": False,
            "error": str(e)
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

# ============================================================
# MODEL VERIFICATION FUNCTION - ADD THIS
# ============================================================
def verify_models():
    """Verify that models are loaded correctly and working"""
    try:
        print("🔍 Verifying model files and paths...")
        
        # Check if files exist
        light_path = getattr(settings, 'MODEL_PATH_LIGHT', None)
        dark_path = getattr(settings, 'MODEL_PATH_DARK', None)
        
        print(f"📁 Light model path: {light_path}")
        print(f"📁 Dark model path: {dark_path}")
        print(f"✅ Light model exists: {os.path.exists(light_path) if light_path else False}")
        print(f"✅ Dark model exists: {os.path.exists(dark_path) if dark_path else False}")
        
        # Check which dark model we're using
        if dark_path and 'deployable' in str(dark_path):
            print("🎯 CORRECT: Using deployable_skin_model_final.pkl")
        elif dark_path and 'hybrid' in str(dark_path):
            print("❌ WRONG: Using hybrid_skin_model_final.pkl instead of deployable model!")
        else:
            print("⚠️  Unknown model file")
            
        # Test model loading
        print("🧪 Testing model loading...")
        light_model = get_ad_model_light()
        dark_model = get_ad_model_dark()
        
        print(f"✅ Light model type: {type(light_model)}")
        print(f"✅ Dark model type: {type(dark_model)}")
        
        # Test prediction with dummy data
        dummy_img = np.random.random((224, 224, 3)).astype('float32')
        
        # Test light model
        light_input = np.expand_dims(dummy_img, 0)
        light_pred = light_model.predict(light_input, verbose=0)
        print(f"✅ Light model test prediction: {light_pred[0][0]:.4f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Model verification failed: {e}")
        return False

# ============================================================
# DEBUG ENDPOINT - ADD THIS
# ============================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def debug_model_performance(request):
    """Debug endpoint to test model performance with the same images"""
    try:
        image_file = request.FILES['image']
        
        print("🧪 DEBUG: Testing both models on the same image...")
        
        # Test light model
        light_result = predict_ad_light(image_file)
        print(f"📊 Light model result: {light_result}")
        
        # Reset and test dark model
        image_file.seek(0)
        dark_result = predict_ad_dark(image_file) 
        print(f"📊 Dark model result: {dark_result}")
        
        # Compare preprocessing
        image_file.seek(0)
        img_light = Image.open(image_file).convert('RGB')
        img_light = ImageOps.fit(img_light, (224, 224), Image.BILINEAR)
        img_array_light = np.array(img_light)
        
        image_file.seek(0)
        img_dark = Image.open(image_file).convert('RGB') 
        img_dark = ImageOps.fit(img_dark, (224, 224), Image.BILINEAR)
        img_array_dark = np.array(img_dark)
        
        preprocessing_match = np.array_equal(img_array_light, img_array_dark)
        
        return Response({
            'preprocessing_consistent': preprocessing_match,
            'light_model_result': light_result,
            'dark_model_result': dark_result,
            'differences': {
                'label_differs': light_result['label'] != dark_result['label'],
                'score_difference': abs(light_result['score'] - dark_result['score']),
                'threshold_difference': f"Light: 0.31 vs Dark: {dark_result.get('threshold_used', 'N/A')}"
            },
            'image_info': {
                'light_shape': img_array_light.shape,
                'dark_shape': img_array_dark.shape,
                'pixel_range_light': f"{img_array_light.min()} - {img_array_light.max()}",
                'pixel_range_dark': f"{img_array_dark.min()} - {img_array_dark.max()}"
            }
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

# ============================================================
# Call model verification on startup
# ============================================================
print("🚀 Initializing skin analysis models...")
verify_models()

# ============================================================
# Updated upload view with model selection (KEEP YOUR EXISTING CODE)
# ============================================================
class AdScanImageUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        logger = logging.getLogger(__name__)
        logger.debug("AdScan upload - FILES: %s", request.FILES)
        logger.debug("AdScan upload - DATA: %s", request.data)

        # Get model selection from request (default to 'light')
        model_type = request.data.get('model_type', 'light')  # 'light' or 'dark'
        logger.debug(f"Using model type: {model_type}")

        # accept multiple files under 'images' or a single file under 'image'
        images = request.FILES.getlist('images')
        if not images:
            single = request.FILES.get('image')
            if single:
                images = [single]
            else:
                return Response(
                    {"error": "No images uploaded. Use form field 'images' (multiple) or 'image' (single)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        results = []
        errors = []
        for idx, img in enumerate(images, start=1):
            # validate with AdScanSerializer
            ad_check = AdScanSerializer(data={'image': img})
            if not ad_check.is_valid():
                errors.append({
                    "index": idx,
                    "filename": getattr(img, "name", f"image-{idx}"),
                    "error": "Invalid image",
                    "details": ad_check.errors
                })
                # skip this file, continue with others
                continue

            # save to AdScanImage (if desired)
            img_serializer = AdScanImageSerializer(data={'image': img})
            if not img_serializer.is_valid():
                errors.append({
                    "index": idx,
                    "filename": getattr(img, "name", f"image-{idx}"),
                    "error": "Failed to save image",
                    "details": img_serializer.errors
                })
                continue

            try:
                # attach user if serializer/model accepts it; otherwise save without user
                try:
                    instance = img_serializer.save(user=request.user)
                except TypeError:
                    instance = img_serializer.save()
            except Exception as e:
                logger.exception("Saving image failed")
                errors.append({
                    "index": idx,
                    "filename": getattr(img, "name", f"image-{idx}"),
                    "error": "Saving image failed",
                    "details": str(e)
                })
                continue

            # run prediction with selected model (use fixed wrapper for dark)
            try:
                if model_type == 'dark':
                    prediction = predict_ad_dark_fixed(img)
                else:
                    prediction = predict_ad_light(img)
            except Exception as e:
                logger.exception("Prediction error")
                errors.append({
                    "index": idx,
                    "filename": getattr(img, "name", f"image-{idx}"),
                    "error": "Prediction failed",
                    "details": str(e)
                })
                continue

            results.append({
                "index": idx,
                "filename": getattr(img, "name", f"image-{idx}"),
                "uploaded": img_serializer.data,
                "prediction": prediction
            })

        response_payload = {
            "results": results,
            "errors": errors,
            "model_used": "Dark Skin Optimized Model (Deployable)" if model_type == 'dark' else "General Model"
        }
        if errors:
            return Response(response_payload, status=status.HTTP_207_MULTI_STATUS)
        return Response(response_payload, status=status.HTTP_201_CREATED)

# ============================================================
# Single image API view (uses light model by default for backward compatibility)
# ============================================================
class AdScanAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AdScanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        image = serializer.validated_data['image']
        try:
            # For single image API, use light model by default
            result = predict_ad_light(image)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ============================================================
# ALL YOUR EXISTING AUTH AND OTHER VIEWS (kept as before)
# ============================================================

# Signup API
class RegisterView(APIView):
    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        password2 = request.data.get('password2')
        if password != password2:
            return Response({'detail': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, email=email, password=password)
        user.profile.role = 'general_user'
        user.profile.save()
        return Response({'message': 'User registered successfully'}, status=status.HTTP_201_CREATED)

# Login API (using JWT)
class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if user:
            code = str(random.randint(100000, 999999))
            Email2FACode.objects.create(user=user, code=code)
            send_mail(
                'Your 2FA Code',
                f'Your 2FA code is: {code}',
                None,
                [user.email],
                fail_silently=False,
            )
            # Ensure profile exists
            if not hasattr(user, 'profile'):
                from .models import Profile
                Profile.objects.create(user=user)
            role = user.profile.role
            return Response({
                'message': '2FA code sent to your email.',
                'user_id': user.id,
                'role': role,
                'username': user.username,
            }, status=status.HTTP_200_OK)
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

class Verify2FAView(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        code = request.data.get('code')
        try:
            user = User.objects.get(id=user_id)
            code_obj = Email2FACode.objects.filter(user=user, code=code).order_by('-created_at').first()
            if code_obj:
                Email2FACode.objects.filter(user=user).delete()
                tokens = get_tokens_for_user(user)
                return Response({
                    'message': '2FA verified!',
                    'role': user.profile.role,
                    'access': tokens['access'],
                    'refresh': tokens['refresh'],
                    'username': user.username,
                }, status=status.HTTP_200_OK)
            else:
                return Response({'detail': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

class CreateAdminView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.profile.role == 'admin':
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, email=email, password=password)
        user.profile.role = 'admin'
        user.profile.save()
        return Response({'message': 'Admin created successfully'}, status=status.HTTP_201_CREATED)

class Resend2FAView(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'User ID required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
            # Optionally delete old codes
            Email2FACode.objects.filter(user=user).delete()
            code = str(random.randint(100000, 999999))
            Email2FACode.objects.create(user=user, code=code)
            send_mail(
                'Your 2FA Code',
                f'Your new 2FA code is: {code}',
                None,
                [user.email],
                fail_silently=False,
            )
            return Response({'message': '2FA code resent.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class UserRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class ContactMessageListCreateView(generics.ListCreateAPIView):
    queryset = ContactMessage.objects.all().order_by('-created_at')
    serializer_class = ContactMessageSerializer

class MessageReplyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = MessageReplySerializer(data={
            'message': pk,
            'admin': request.user.id,
            'reply_text': request.data.get('reply_text')
        })
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class ContactMessageUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [IsAuthenticated]

class MessageReplyUpdateView(generics.RetrieveUpdateAPIView):
    queryset = MessageReply.objects.all()
    serializer_class = MessageReplySerializer
    permission_classes = [IsAuthenticated]

    def put(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class UserContactMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        messages = ContactMessage.objects.filter(email=request.user.email).order_by('-created_at')
        serializer = ContactMessageSerializer(messages, many=True)
        return Response(serializer.data)

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

# Admin dashboard stats view
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_stats(request):
    """
    Return minimal stats for admin dashboard.
    """
    user_count = User.objects.count()
    return Response({"user_count": user_count})

# ------------------ Universal symptom assessment (new) ------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def universal_symptom_assessment(request):
    logger = logging.getLogger(__name__)
    data = request.data or {}

    symptom_answers = data.get("symptom_answers", {})
    scan_results = data.get("scan_results", [])
    user_type = data.get("user_type", "patient")
    provided_skin_tone = data.get("detected_skin_tone")

    if not symptom_answers:
        return Response({"error": "No symptom answers provided"}, status=status.HTTP_400_BAD_REQUEST)
    if not scan_results:
        return Response({"error": "No scan results provided"}, status=status.HTTP_400_BAD_REQUEST)

    # determine skin tone context: prefer provided value, otherwise infer from model_used in scan_results
    skin_tone = (provided_skin_tone or "").lower() if provided_skin_tone else None
    if not skin_tone:
        counts = {"dark": 0, "light": 0}
        for r in scan_results:
            mu = (r.get("prediction", {}) or {}).get("model_used", "") or r.get("model_used", "") or ""
            mu_l = mu.lower()
            if "dark" in mu_l:
                counts["dark"] += 1
            elif "light" in mu_l or "general" in mu_l:
                counts["light"] += 1
        skin_tone = "dark" if counts["dark"] > counts["light"] else "light"

    try:
        assessment = calculate_skin_tone_aware_score(symptom_answers, skin_tone, user_type, scan_results)
        report = generate_universal_report(assessment, symptom_answers, scan_results, user_type)

        # Generate PDF with expanded data
        pdf_buffer = generate_pdf_report(report, symptom_answers, scan_results, request.user, assessment)
        pdf_file = ContentFile(pdf_buffer.getvalue(), name=f"assessment_{request.user.id}_{assessment['final_confidence']:.2f}.pdf")

        # Create a new Chat for this assessment (instead of get_or_create)
        chat = Chat.objects.create(user=request.user, messages=[])

        # Append messages to the new Chat
        chat.messages.append({
            "sender": "user",
            "text": f"Universal assessment requested (skin_tone={skin_tone}, user_type={user_type})"
        })
        chat.messages.append({
            "sender": "ai",
            "text": report.get("summary", "Assessment completed."),
            "meta": {
                "assessment_result": assessment,
                "skin_insights": generate_skin_tone_insights(symptom_answers, skin_tone, scan_results),
            }
        })

        chat.pdf_report = pdf_file
        chat.save()

        report['pdf_url'] = chat.pdf_report.url if chat.pdf_report else None
        return Response(report, status=status.HTTP_200_OK)
    except Exception as e:
        logger.exception("universal_symptom_assessment failed")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_skin_tone_aware_score(symptom_answers, skin_tone, user_type, scan_results):
    BASE_WEIGHTS = {
        'symptom_duration': [0.1, 0.3, 0.6, 0.8],
        'itching_severity': [0.0, 0.2, 0.5, 0.9],
        'skin_texture': [0.0, 0.2, 0.5, 0.8],
        'location_pattern': [0.2, 0.7, 0.5, 0.6],
    }
    PIGMENTATION_WEIGHTS = {
        'light': [0.0, 0.1, 0.2, 0.3],
        'dark':  [0.0, 0.3, 0.6, 0.8]
    }

    ai_confidence = calculate_ai_consensus(scan_results)

    total = 0.0
    count = 0
    for q, val in symptom_answers.items():
        try:
            idx = int(val)
        except Exception:
            continue
        if q in BASE_WEIGHTS:
            arr = BASE_WEIGHTS[q]
            idx = max(0, min(idx, len(arr)-1))
            total += arr[idx]
            count += 1
        elif q == 'pigmentation_changes':
            key = skin_tone if skin_tone in PIGMENTATION_WEIGHTS else 'light'
            arr = PIGMENTATION_WEIGHTS[key]
            idx = max(0, min(idx, len(arr)-1))
            total += arr[idx]
            count += 1

    symptom_score = (total / count) if count > 0 else 0.0

    if user_type == "clinician":
        final_confidence = (symptom_score * 0.6) + (ai_confidence * 0.4)
    else:
        final_confidence = (symptom_score * 0.4) + (ai_confidence * 0.6)

    return {
        'final_confidence': float(final_confidence),
        'symptom_score': float(symptom_score),
        'ai_confidence': float(ai_confidence),
        'skin_tone_considered': skin_tone,
        'user_type': user_type,
        'breakdown': {
            'base_symptoms': float(symptom_score),
            'pigmentation_impact': get_pigmentation_impact(symptom_answers.get('pigmentation_changes'), skin_tone),
            'ai_contribution': float(ai_confidence * (0.4 if user_type == 'clinician' else 0.6)),
            'symptom_contribution': float(symptom_score * (0.6 if user_type == 'clinician' else 0.4))
        }
    }

def calculate_ai_consensus(scan_results):
    if not scan_results:
        return 0.0
    total_conf = 0.0
    total_weight = 0.0
    for r in scan_results:
        prediction = r.get('prediction', {}) or {}
        conf = float(prediction.get('score') or prediction.get('confidence') or 0.0)
        label = prediction.get('label', '')
        weight = conf if label == 'ad' else (1.0 - conf)
        total_conf += conf * weight
        total_weight += weight
    return float(total_conf / total_weight) if total_weight > 0 else 0.0

def get_pigmentation_impact(pigmentation_answer, skin_tone):
    if pigmentation_answer is None:
        return "No pigmentation data provided"
    try:
        severity = int(pigmentation_answer)
    except Exception:
        return "Invalid pigmentation answer"
    if skin_tone == 'dark':
        impacts = [
            "No significant pigmentation changes",
            "Mild hyper/hypopigmentation - common in AD on darker skin",
            "Moderate color changes - supports chronic AD diagnosis",
            "Severe persistent pigmentation - strongly suggests chronic AD"
        ]
    else:
        impacts = [
            "No significant pigmentation changes",
            "Mild color changes - can occur in AD but less significant",
            "Moderate temporary color changes - may indicate inflammation resolution",
            "Significant persistent changes - less common in light skin AD"
        ]
    return impacts[severity] if 0 <= severity < len(impacts) else impacts[-1]

def generate_universal_report(assessment_result, symptom_answers, scan_results, user_type):
    final_confidence = assessment_result['final_confidence']
    if final_confidence >= 0.7:
        level = "HIGH"
        urgency = "Strong evidence"
    elif final_confidence >= 0.4:
        level = "MODERATE"
        urgency = "Suggestive"
    else:
        level = "LOW"
        urgency = "Limited evidence"

    skin_tone = assessment_result.get('skin_tone_considered', 'unknown')
    skin_insights = generate_skin_tone_insights(symptom_answers, skin_tone, scan_results)

    if user_type == "clinician":
        report = generate_clinician_report(level, final_confidence, symptom_answers, skin_insights, assessment_result['ai_confidence'], skin_tone)
    else:
        report = generate_patient_report(level, final_confidence, symptom_answers, skin_insights, assessment_result['ai_confidence'], skin_tone)

    report.update({
        "assessment_level": level,
        "final_confidence": final_confidence,
        "urgency": urgency,
        "skin_tone_considered": skin_tone,
        "images_analyzed": len(scan_results),
        "timestamp": str(np.datetime64('now'))
    })
    return report

def generate_skin_tone_insights(symptom_answers, skin_tone, scan_results):
    insights = []
    pigmentation = symptom_answers.get('pigmentation_changes')
    if pigmentation is not None:
        try:
            sev = int(pigmentation)
        except Exception:
            sev = 0
        if skin_tone == 'dark':
            if sev >= 2:
                insights.append("Pigmentation changes support chronic AD diagnosis")
                insights.append("Post-inflammatory changes common in melanated skin")
            if sev >= 1:
                insights.append("Consider hyperpigmentation management in treatment plan")
        else:
            if sev >= 2:
                insights.append("Persistent color changes less typical - monitor progression")

    loc = symptom_answers.get('location_pattern')
    try:
        if loc is not None and int(loc) == 1:
            insights.append("Flexural distribution classic for AD across all skin tones")
    except Exception:
        pass

    dur = symptom_answers.get('symptom_duration')
    try:
        if dur is not None and int(dur) >= 2:
            insights.append("Chronic presentation supports AD diagnosis")
    except Exception:
        pass

    itch = symptom_answers.get('itching_severity')
    try:
        if itch is not None and int(itch) >= 2:
            insights.append("Significant itching characteristic of AD")
    except Exception:
        pass

    return insights

def generate_clinician_report(assessment_level, final_confidence, symptom_answers, skin_insights, ai_confidence, skin_tone):
    return {
        "report_type": "clinical",
        "title": f"CLINICAL ASSESSMENT: {assessment_level} PROBABILITY OF ATOPIC DERMATITIS",
        "summary": f"Final Confidence Score: {final_confidence:.2f}",
        "breakdown": {
            "ai_analysis_confidence": f"{ai_confidence:.2f}",
            "clinical_symptom_score": f"{symptom_answers.get('clinical_score', 0):.2f}",
            "skin_tone_considerations": skin_tone
        },
        "key_findings": skin_insights,
        "recommendations": [
            "Consider topical corticosteroids for active flares",
            "Implement daily emollient therapy",
            "Patient education on trigger avoidance",
            "Follow-up in 4-6 weeks to assess treatment response"
        ],
        "notes": [
            "AI analysis should be used as decision support only",
            f"Assessment considered {skin_tone} skin context"
        ]
    }

def generate_patient_report(assessment_level, final_confidence, symptom_answers, skin_insights, ai_confidence, skin_tone):
    return {
        "report_type": "patient",
        "title": f"YOUR ASSESSMENT: {assessment_level} PROBABILITY OF ATOPIC DERMATITIS",
        "summary": f"Overall Confidence: {final_confidence:.2f}",
        "breakdown": {
            "ai_analysis": f"{ai_confidence:.2f} confidence",
            "your_symptoms": "Strong match with AD patterns" if final_confidence > 0.5 else "Partial match with AD patterns",
            "skin_considerations": f"Analysis considered {skin_tone} skin"
        },
        "what_this_means": skin_insights,
        "next_steps": [
            "Consult a dermatologist for proper diagnosis",
            "Use fragrance-free moisturizers daily",
            "Avoid harsh soaps and known triggers"
        ]
    }

AD_QUESTIONS = [
    "Is the affected area itchy?",
    "Do you notice redness or inflammation?",
    "Is there any oozing or crusting?",
    "Does it occur in skin folds (elbows, knees, wrists)?",
    "Is there a history of eczema or allergies?",
]

@api_view(["POST"])
@permission_classes([AllowAny])
def chat_view(request):
    logger = logging.getLogger(__name__)
    data = request.data or {}
    user_input = (data.get("user_input") or "").strip()
    previous_state = data.get("previous_state") or []
    model_result = data.get("model_result") or []

    # DEBUG: log incoming chat payload (inspect server console)
    logger.debug("chat_view: user_input=%r", user_input)
    logger.debug("chat_view: previous_state (len=%d) = %s", len(previous_state), previous_state)
    logger.debug("chat_view: model_result = %s", model_result)

    # Summarize scan results
    total = len(model_result)
    ad_count = sum(1 for r in model_result if r.get("prediction", {}).get("label") == "ad")
    summary = (
        f"{ad_count} of {total} uploaded image{'s' if total != 1 else ''} show signs of Atopic Dermatitis."
        if total > 0 else "No scan results available."
    )

    # Robustly pair AI questions with user answers.
    answers = {}
    last_ai_question = None
    normalized_questions = [q.strip().lower() for q in AD_QUESTIONS]

    for msg in previous_state:
        sender = (msg.get("sender") or "").strip().lower()
        text = (msg.get("text") or "").strip()
        if sender == "ai" and text.lower() in normalized_questions:
            last_ai_question = text
            continue
        if sender == "user" and last_ai_question:
            if last_ai_question not in answers and text != "":
                answers[last_ai_question] = text.lower()
            last_ai_question = None

    if last_ai_question and last_ai_question not in answers and user_input:
        answers[last_ai_question] = user_input.lower()

    next_question = None
    for q in AD_QUESTIONS:
        if q not in answers:
            next_question = q
            break

    if not previous_state:
        reply = f"Hello — {summary}"
    else:
        reply = f"I received your message: \"{user_input}\". {summary}"
        if next_question is None:
            reply += " All questions completed."

    def normalize_yes_no(t):
        if not t:
            return None
        v = t.strip().lower()
        if v in ("yes", "y", "yeah", "yep", "true", "1"):
            return True
        if v in ("no", "n", "nope", "nah", "false", "0"):
            return False
        return None

    normalized = {q: normalize_yes_no(a) for q, a in answers.items()}
    total_answered = sum(1 for v in normalized.values() if v is not None)
    yes_count = sum(1 for v in normalized.values() if v is True)
    risk_estimate = (yes_count / total_answered) if total_answered > 0 else 0.0

    # After generating reply, save to Chat
    chat, created = Chat.objects.get_or_create(user=request.user, defaults={'messages': []})
    chat.messages.append({"sender": "user", "text": user_input})
    chat.messages.append({"sender": "ai", "text": reply})
    chat.save()

    return Response({
        "reply": reply,
        "next_question": next_question,
        "risk_estimate": float(risk_estimate)
    })

def generate_pdf_report(report, symptom_answers, scan_results, user, assessment):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y_position = height - 50  # Starting Y position

    # Helper to add text and handle page breaks
    def add_text(text, font_size=12, bold=False, indent=0):
        nonlocal y_position
        if bold:
            c.setFont("Helvetica-Bold", font_size)
        else:
            c.setFont("Helvetica", font_size)
        lines = text.split('\n')
        for line in lines:
            if y_position < 100:  # New page if near bottom
                c.showPage()
                y_position = height - 50
                c.setFont("Helvetica-Bold" if bold else "Helvetica", font_size)
            c.drawString(100 + indent, y_position, line)
            y_position -= font_size + 2

    # Title
    add_text(report.get('title', 'Assessment Report'), font_size=16, bold=True)
    y_position -= 20

    # Summary
    add_text(f"Summary: {report.get('summary', 'N/A')}", font_size=12)
    y_position -= 20

    # Section 1: Scanned Images
    add_text("1. Scanned Images", font_size=14, bold=True)
    y_position -= 10
    for i, res in enumerate(scan_results):
        # Get image path from AdScanImage if available
        img_path = None
        if res.get('uploaded') and res['uploaded'].get('id'):
            try:
                ad_img = AdScanImage.objects.get(id=res['uploaded']['id'])
                img_path = ad_img.image.path  # File path for embedding
            except AdScanImage.DoesNotExist:
                pass
        if img_path:
            try:
                img = ImageReader(img_path)
                c.drawImage(img, 100, y_position - 100, width=100, height=100)
                y_position -= 120
            except Exception as e:
                add_text(f"Image {i+1}: Failed to embed ({str(e)})", indent=20)
        else:
            add_text(f"Image {i+1}: No image available", indent=20)
        if y_position < 150:
            c.showPage()
            y_position = height - 50

    # Section 2: Initial Scan Results
    add_text("2. Initial Scan Results", font_size=14, bold=True)
    y_position -= 10
    for i, res in enumerate(scan_results):
        pred = res.get('prediction', {})
        add_text(f"Image {i+1}: {pred.get('label', 'N/A')} (Score: {pred.get('score', 0):.2f})", indent=20)
        add_text(f"Model Used: {pred.get('model_used', 'N/A')}", indent=40)
        y_position -= 10
        if y_position < 100:
            c.showPage()
            y_position = height - 50

    # Section 3: Form Questions and Answers
    add_text("3. Form Questions and Answers", font_size=14, bold=True)
    y_position -= 10
    for q, a in symptom_answers.items():
        add_text(f"{q}: {a}", indent=20)
        if y_position < 100:
            c.showPage()
            y_position = height - 50

    # Section 4: Assessment Details
    add_text("4. Assessment Details", font_size=14, bold=True)
    y_position -= 10
    add_text(f"Assessment Level: {report.get('assessment_level', 'N/A')}", indent=20)
    add_text(f"Final Confidence: {report.get('final_confidence', 0):.2f}", indent=20)
    add_text(f"Skin Tone Considered: {assessment.get('skin_tone_considered', 'N/A')}", indent=20)
    add_text(f"Images Analyzed: {assessment.get('images_analyzed', 0)}", indent=20)
    add_text(f"User Type: {assessment.get('user_type', 'N/A')}", indent=20)
    if 'breakdown' in assessment:
        add_text("Breakdown:", indent=20)
        for key, value in assessment['breakdown'].items():
            add_text(f"{key}: {value}", indent=40)
    if 'key_findings' in report:
        add_text("Key Findings:", indent=20)
        for finding in report['key_findings']:
            add_text(f"- {finding}", indent=40)
    if 'recommendations' in report:
        add_text("Recommendations:", indent=20)
        for rec in report['recommendations']:
            add_text(f"- {rec}", indent=40)
    if 'next_steps' in report:
        add_text("Next Steps:", indent=20)
        for step in report['next_steps']:
            add_text(f"- {step}", indent=40)
    y_position -= 20

    # Section 5: Final Result
    add_text("5. Final Result", font_size=14, bold=True)
    y_position -= 10
    add_text(f"Overall Confidence: {assessment.get('final_confidence', 0):.2f}", indent=20)
    add_text(f"Urgency: {report.get('urgency', 'N/A')}", indent=20)
    add_text(f"Timestamp: {report.get('timestamp', 'N/A')}", indent=20)

    c.save()
    buffer.seek(0)
    return buffer

# Add Chat views
class ChatListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ChatRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(user=self.request.user)

import builtins  # added for safe temporary injections used by diagnostics/wrappers

# ============================================================
# DIAGNOSTIC endpoint (ensure this is present so urls.py can import it)
# ============================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def diagnose_model_issue(request):
    """Return basic diagnostics for model loading and a sample run."""
    try:
        image_file = request.FILES.get('image')
        if image_file is None:
            return Response({"error": "Provide multipart/form-data with field 'image'."}, status=400)

        light_model = get_ad_model_light()
        dark_model = get_ad_model_dark()
        dark_methods = [m for m in dir(dark_model) if not m.startswith('_')]
        has_predict = hasattr(dark_model, 'predict_single_image')

        # simple preprocessing sample
        image_file.seek(0)
        img = Image.open(image_file).convert('RGB')
        img = ImageOps.fit(img, (224, 224), Image.BILINEAR)
        arr = np.array(img).astype('float32') / 255.0

        # write a temp file and try a best-effort call
        debug_path = None
        raw_result = None
        raw_error = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp:
                img.save(tmp.name, format='JPEG', quality=95)
                debug_path = tmp.name
            try:
                if has_predict:
                    raw_result = dark_model.predict_single_image(debug_path, use_hybrid=True)
            except Exception as e:
                raw_error = str(e)
        finally:
            if debug_path and os.path.exists(debug_path):
                try:
                    os.unlink(debug_path)
                except Exception:
                    pass

        return Response({
            "light_model_type": str(type(light_model)),
            "dark_model_type": str(type(dark_model)),
            "dark_model_methods": dark_methods,
            "has_predict_single_image": has_predict,
            "preprocessed_shape": arr.shape,
            "raw_result_sample": raw_result,
            "raw_error_sample": raw_error
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# ============================================================
# MODEL HEALTH CHECK endpoint (ensure this is present so urls.py can import it)
# ============================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def model_health_check(request):
    """Quick health check for both models."""
    try:
        light_model = get_ad_model_light()
        dark_model = get_ad_model_dark()
        dark_has_predict = hasattr(dark_model, 'predict_single_image')

        # quick light model smoke test
        try:
            dummy = np.random.random((1, 224, 224, 3)).astype('float32')
            _ = light_model.predict(dummy, verbose=0)
            light_ok = True
        except Exception:
            light_ok = False

        # quick dark model smoke test (best-effort)
        dark_ok = False
        try:
            test_img = Image.new('RGB', (224, 224), color='white')
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp:
                test_path = tmp.name
                test_img.save(test_path, 'JPEG')
            try:
                if dark_has_predict:
                    res = dark_model.predict_single_image(test_path)
                    dark_ok = res is not None
            except Exception:
                dark_ok = False
            finally:
                try:
                    os.unlink(test_path)
                except Exception:
                    pass
        except Exception:
            dark_ok = False

        return Response({
            "light_model": {"loaded": True, "working": light_ok, "type": str(type(light_model))},
            "dark_model": {"loaded": True, "working": dark_ok, "type": str(type(dark_model)), "has_predict_single_image": dark_has_predict},
            "overall_status": "healthy" if light_ok and dark_ok else "degraded"
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_adscan(request):
    """
    Create a new Chat entry for every saved scan so previous saves are retained.
    Attaches a generated PDF (if generation succeeds) and returns the created Chat.
    """
    logger = logging.getLogger(__name__)
    try:
        user = request.user
        data = request.data or {}
        results = data.get("results", []) or []
        universal_report = data.get("universal_report") or {}
        risk_estimate = float(data.get("risk_estimate") or 0.0)
        model_used = data.get("model_used") or "unknown"
        timestamp = data.get("timestamp") or None

        # Build messages for this saved scan
        messages = [
            {"sender": "user", "text": f"Saved scan ({model_used}){(' at '+timestamp) if timestamp else ''}"},
        ]
        summary = universal_report.get("summary") or f"Scan saved (risk={risk_estimate:.2f})"
        messages.append({
            "sender": "ai",
            "text": summary,
            "meta": {
                "risk_estimate": risk_estimate,
                "model_used": model_used,
                "images": len(results)
            }
        })

        # Create a new Chat record (do not overwrite existing ones)
        chat = Chat.objects.create(user=user, messages=messages)

        # Try to generate and attach PDF (best-effort)
        try:
            symptom_answers = universal_report.get("symptom_answers", {})
            pdf_buffer = generate_pdf_report(universal_report, symptom_answers, results, user, universal_report)
            if pdf_buffer:
                pdf_name = f"adscan_{user.id}_{int(time.time())}.pdf"
                chat.pdf_report.save(pdf_name, ContentFile(pdf_buffer.getvalue()), save=False)
        except Exception as e:
            logger.exception("PDF generation failed for save_adscan: %s", e)

        chat.save()
        serializer = ChatSerializer(chat, context={"request": request})
        return Response({"message": "Scan saved successfully.", "chat": serializer.data}, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.exception("save_adscan failed: %s", e)
        return Response({"error": "Failed to save scan."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_scan_history(request):
    """
    Get list of all saved scans for the current user
    """
    try:
        chats = Chat.objects.filter(user=request.user).order_by('-created_at')
        serializer = ChatSerializer(chats, many=True, context={"request": request})
        return Response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_scan_details(request, chat_id):
    """
    Get full details of a specific saved scan
    """
    try:
        chat = Chat.objects.get(id=chat_id, user=request.user)
        
        # Extract the detailed data from chat messages and meta
        scan_data = {
            "id": chat.id,
            "created_at": chat.created_at,
            "messages": chat.messages,
            "has_pdf": bool(chat.pdf_report),
            "pdf_url": chat.pdf_report.url if chat.pdf_report else None
        }
        
        return Response(scan_data)
    except Chat.DoesNotExist:
        return Response({"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_scan_pdf(request, chat_id):
    """
    Download the PDF report for a specific scan
    """
    try:
        chat = Chat.objects.get(id=chat_id, user=request.user)
        
        if not chat.pdf_report:
            return Response({"error": "No PDF available for this scan"}, status=status.HTTP_404_NOT_FOUND)
        
        # Return the PDF file
        response = FileResponse(chat.pdf_report.open(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ad_scan_report_{chat_id}.pdf"'
        return response
        
    except Chat.DoesNotExist:
        return Response({"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_scan(request, chat_id):
    """
    Delete a saved scan
    """
    try:
        chat = Chat.objects.get(id=chat_id, user=request.user)
        chat.delete()
        return Response({"message": "Scan deleted successfully"})
    except Chat.DoesNotExist:
        return Response({"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)