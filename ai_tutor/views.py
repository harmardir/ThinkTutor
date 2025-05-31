from django.shortcuts import render
from django.http import JsonResponse

def ask_ai(request):
    if request.method == "POST":
        question = request.POST.get("question", "")
        # Placeholder: Replace with AWS Bedrock call later
        answer = f"This is a placeholder answer for: {question}"
        return JsonResponse({"answer": answer})
    return render(request, "ai_tutor/ask.html")

