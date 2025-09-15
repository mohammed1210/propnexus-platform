# File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

from typing import Union

from typing_extensions import Annotated, Literal, TypeAlias

from ..._models import BaseModel
from ..._utils import PropertyInfo

__all__ = ["CustomToolInputFormat", "Text", "Grammar"]


class Text(BaseModel):
    type: Literal["text"]
    """Unconstrained text format. Always `text`."""


class Grammar(BaseModel):
    definition: str
    """The grammar definition."""

    syntax: Literal["lark", "regex"]
    """The syntax of the grammar definition. One of `lark` or `regex`."""

    type: Literal["grammar"]
    """Grammar format. Always `grammar`."""


CustomToolInputFormat: TypeAlias = Annotated[
    Union[Text, Grammar], PropertyInfo(discriminator="type")
]
