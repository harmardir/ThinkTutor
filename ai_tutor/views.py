from django.shortcuts import render
from django.http import JsonResponse
from .bedrock_client import BedrockClient
from django.contrib.auth.decorators import login_required


'''
def ask_ai(request):
    if request.method == "POST":
        question = request.POST.get("question", "")
        # Placeholder: Replace with AWS Bedrock call later
        answer = f"This is a placeholder answer for: {question}"
        return JsonResponse({"answer": answer})
    return render(request, "ai_tutor/ask.html")
'''


bedrock_client = BedrockClient(region_name='eu-central-1')
MODEL_ID = "amazon.titan-text-express-v1"  # Or another model you confirmed is available


@login_required
def ask_ai(request):
    if request.method == "POST":
        question = request.POST.get("question", "")
        try:
            answer = bedrock_client.generate_text(MODEL_ID, question, max_tokens=300)
        except Exception as e:
            answer = f"Error contacting Bedrock: {str(e)}"
        return JsonResponse({"answer": answer})
    return render(request, "ai_tutor/ask.html")



