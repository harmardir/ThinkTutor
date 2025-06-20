from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('ask/', include('ai_tutor.urls')),
    path('users/', include('users.urls')), 
    path('', include('main.urls')),
]
