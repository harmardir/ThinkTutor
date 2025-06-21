from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

class SimpleUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ("username", "password1", "password2")

    def __init__(self, *args, **kwargs):
        super(SimpleUserCreationForm, self).__init__(*args, **kwargs)
        for field_name in ['username', 'password1', 'password2']:
            self.fields[field_name].help_text = ''