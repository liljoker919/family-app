from .models import FamilyMembership


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.account = None
        if request.user.is_authenticated:
            membership = (
                FamilyMembership.objects
                .filter(user=request.user)
                .select_related("account")
                .first()
            )
            if membership:
                request.account = membership.account
        return self.get_response(request)
