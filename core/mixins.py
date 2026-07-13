from django.core.exceptions import PermissionDenied
from django.http import Http404
from django.shortcuts import get_object_or_404


class AccountScopedMixin:
    """Scopes ListView/DetailView/UpdateView/DeleteView querysets to request.account.

    Set account_lookup for models that reach their account via a parent FK
    instead of their own field, e.g. account_lookup = "vehicle__account" for
    a model whose tenant is determined by vehicle.account.
    """

    account_lookup = "account"

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.account is None:
            # account is nullable until a later migration makes it required —
            # filtering by account=None here would match legacy/orphaned rows
            # instead of correctly showing nothing.
            return qs.none()
        return qs.filter(**{self.account_lookup: self.request.account})


class AccountStampMixin:
    """Stamps request.account onto new objects in CreateView.form_valid()."""

    def form_valid(self, form):
        if self.request.account is None:
            raise PermissionDenied("No active family account found.")
        form.instance.account = self.request.account
        return super().form_valid(form)


def get_scoped_object_or_404(model, account, **kwargs):
    """get_object_or_404 scoped to account, safe against account=None.

    Use for parent-object lookups in child-model CreateViews (e.g. looking
    up the Vehicle a new VehicleService belongs to) instead of a bare
    get_object_or_404(Model, pk=..., account=self.request.account), which
    would match legacy/orphaned rows if account is None.
    """
    if account is None:
        raise Http404
    return get_object_or_404(model, account=account, **kwargs)
