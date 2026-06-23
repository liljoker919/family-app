from django.urls import path

from . import views

app_name = "tasks"

urlpatterns = [
    path("", views.TaskBoardView.as_view(), name="board"),
    path("new/", views.TaskCreateView.as_view(), name="task_create"),
    path("<int:pk>/", views.TaskDetailView.as_view(), name="task_detail"),
    path("<int:pk>/edit/", views.TaskUpdateView.as_view(), name="task_update"),
    path("<int:pk>/delete/", views.TaskDeleteView.as_view(), name="task_delete"),
    path("<int:pk>/status/", views.change_status, name="change_status"),
    path("<int:pk>/comment/", views.add_comment, name="add_comment"),
]
