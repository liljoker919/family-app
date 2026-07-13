class AccountScopedMixin:
    """Scopes ListView/DetailView/UpdateView/DeleteView querysets to request.account.

    Set account_lookup for models that reach their account via a parent FK
    instead of their own field, e.g. account_lookup = "vehicle__account" for
    a model whose tenant is determined by vehicle.account.
    """

    account_lookup = "account"

    def get_queryset(self):
        return super().get_queryset().filter(**{self.account_lookup: self.request.account})


class AccountStampMixin:
    """Stamps request.account onto new objects in CreateView.form_valid()."""

    def form_valid(self, form):
        form.instance.account = self.request.account
        return super().form_valid(form)
