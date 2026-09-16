from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Course, Student


@admin.register(Student)
class StudentAdmin(SimpleHistoryAdmin):
    list_display = ["name", "school_name", "grade_level", "account"]
    search_fields = ["name", "school_name"]


@admin.register(Course)
class CourseAdmin(SimpleHistoryAdmin):
    list_display = ["name", "student", "instructor", "term", "account"]
    list_filter = ["term", "student"]
    search_fields = ["name", "instructor", "student__name"]
