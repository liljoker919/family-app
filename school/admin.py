from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Assignment, Course, Student, Subtask


@admin.register(Student)
class StudentAdmin(SimpleHistoryAdmin):
    list_display = ["name", "school_name", "grade_level", "account"]
    search_fields = ["name", "school_name"]


@admin.register(Course)
class CourseAdmin(SimpleHistoryAdmin):
    list_display = ["name", "student", "instructor", "term", "account"]
    list_filter = ["term", "student"]
    search_fields = ["name", "instructor", "student__name"]


class SubtaskInline(admin.TabularInline):
    model = Subtask
    extra = 0


@admin.register(Assignment)
class AssignmentAdmin(SimpleHistoryAdmin):
    list_display = ["title", "course", "student", "type", "status", "due_date"]
    list_filter = ["type", "status", "course"]
    search_fields = ["title", "course__name", "student__name"]
    date_hierarchy = "due_date"
    inlines = [SubtaskInline]
