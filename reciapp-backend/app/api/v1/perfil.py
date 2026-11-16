"""Perfil adaptativo: preferencias explícitas + lo aprendido del uso."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.crud import crud_perfil
from app.db.session import get_db
from app.models.user import Usuario
from app.schemas.perfil import EventoIn, PerfilOut, PreferenciasUpdate
from app.services import impacto
from app.services import perfil_adaptativo as pa

router = APIRouter()


def _out(perfil) -> PerfilOut:
    datos = pa.normalizar(perfil.datos)
    return PerfilOut(usuario_id=perfil.usuario_id, preferencias=datos["preferencias"],
                     aprendido=datos["aprendido"], errores=datos["errores"],
                     emociones=datos["emociones"], derivado=pa.derivar(datos))


@router.get("/me", response_model=PerfilOut, summary="Perfil adaptativo del usuario actual")
def mi_perfil(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    return _out(crud_perfil.obtener(db, user.id))


@router.put("/me/preferencias", response_model=PerfilOut, summary="Actualizar preferencias explícitas")
def actualizar_preferencias(data: PreferenciasUpdate, db: Session = Depends(get_db),
                            user: Usuario = Depends(get_current_user)):
    cambios = data.model_dump(exclude_none=True)
    if cambios.pop("usar_velocidad_adaptativa", False):
        cambios["velocidad_voz"] = None
    return _out(crud_perfil.registrar_evento(db, user.id, "preferencias", cambios))


@router.post("/eventos", response_model=PerfilOut, summary="Registrar un evento de uso (actualiza el perfil)")
def registrar_evento(evento: EventoIn, db: Session = Depends(get_db),
                     user: Usuario = Depends(get_current_user)):
    return _out(crud_perfil.registrar_evento(db, user.id, evento.tipo, evento.datos))


@router.get("/me/impacto", summary="Impacto ambiental estimado y nivel (reflexivo)")
def mi_impacto(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    return impacto.calcular(crud_perfil.solicitudes_completadas(db, user.id, user.rol))
