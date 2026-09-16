from django.urls import path

from . import views

app_name = "school"

urlpatterns = [
    path("students/", views.StudentListView.as_view(), name="student_list"),
    path("students/add/", views.StudentCreateView.as_view(), name="student_create"),
    path("students/<int:pk>/", views.StudentDetailView.as_view(), name="student_detail"),
    path("students/<int:pk>/edit/", views.StudentUpdateView.as_view(), name="student_update"),
    path("students/<int:pk>/delete/", views.StudentDeleteView.as_view(), name="student_delete"),
    path("students/<int:student_pk>/courses/add/", views.CourseCreateView.as_view(), name="course_create"),
    path("courses/<int:pk>/", views.CourseDetailView.as_view(), name="course_detail"),
    path("courses/<int:pk>/edit/", views.CourseUpdateView.as_view(), name="course_update"),
    path("courses/<int:pk>/delete/", views.CourseDeleteView.as_view(), name="course_delete"),
    path("courses/<int:course_pk>/assignments/add/", views.AssignmentCreateView.as_view(), name="assignment_create"),
    path("assignments/<int:pk>/", views.AssignmentDetailView.as_view(), name="assignment_detail"),
    path("assignments/<int:pk>/edit/", views.AssignmentUpdateView.as_view(), name="assignment_update"),
    path("assignments/<int:pk>/delete/", views.AssignmentDeleteView.as_view(), name="assignment_delete"),
]
