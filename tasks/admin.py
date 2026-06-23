from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import FamilyTask, TaskComment


class TaskCommentInline(admin.TabularInline):
    model = TaskComment
    extra = 0
    readonly_fields = ("author", "created_at")


@admin.register(FamilyTask)
class FamilyTaskAdmin(SimpleHistoryAdmin):
    list_display = ("title", "status", "priority", "assigned_to", "due_date", "created_at")
    list_filter = ("status", "priority", "assigned_to")
    search_fields = ("title", "description")
    inlines = [TaskCommentInline]


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ("task", "author", "created_at")
    list_filter = ("author",)
