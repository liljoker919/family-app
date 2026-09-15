from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Student


@admin.register(Student)
class StudentAdmin(SimpleHistoryAdmin):
    list_display = ["name", "school_name", "grade_level", "account"]
    search_fields = ["name", "school_name"]
