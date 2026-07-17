def get_subscriber_for_request(request):
    """dj-stripe's DJSTRIPE_SUBSCRIBER_MODEL_REQUEST_CALLBACK.

    The paying subscriber in this app is a FamilyAccount (set via
    TenantMiddleware), not the logged-in User — dj-stripe's own default
    callback returns request.user, which is the wrong model here.
    """
    return request.account
