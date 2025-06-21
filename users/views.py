from django.shortcuts import render, redirect
from .forms import SimpleUserCreationForm
from django.contrib import messages

def register(request):
    if request.method == "POST":
        form = SimpleUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Account created! You can now log in.")
            return redirect('login')
    else:
        form = SimpleUserCreationForm()

    return render(request, 'users/register.html', {'form': form})

