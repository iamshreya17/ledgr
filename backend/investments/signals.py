from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Portfolio, UserPreference


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_default_portfolio(sender, instance, created, **kwargs):
    if created:
        Portfolio.objects.get_or_create(user=instance, name="Personal", defaults={"is_default": True})
        UserPreference.objects.get_or_create(user=instance)
