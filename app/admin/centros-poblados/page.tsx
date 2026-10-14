import { redirect } from "next/navigation";

// Los centros poblados ahora se editan desde la tabla de configuración de
// estaciones (acción 📍 por fila). Se conserva la ruta para enlaces guardados.
export default function AdminCentrosPobladosPage() {
  redirect("/admin/config");
}
