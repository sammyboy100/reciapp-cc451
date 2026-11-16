from typing import Literal

from pydantic import BaseModel, Field

Material = Literal["plastico", "papel", "carton", "vidrio", "metal", "organico", "electronicos"]


class JornadaCreate(BaseModel):
    titulo: str = Field(min_length=3, max_length=80)
    fecha: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    franja_horaria: Literal["manana", "tarde", "noche"] = "manana"
    punto_encuentro: str = Field(min_length=4, max_length=200)
    latitud: float | None = None
    longitud: float | None = None


class ParticiparIn(BaseModel):
    tipo_residuo: Material
    cantidad_kg: float = Field(gt=0, le=200)


class SusIn(BaseModel):
    respuestas: list[int] = Field(min_length=10, max_length=10)
    comentario: str | None = Field(default=None, max_length=500)
