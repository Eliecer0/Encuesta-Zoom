const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servir nuestra aplicación
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------
// REUNIONES
// ------------------------------------
// Cada reunión tendrá sus propios datos.
//
// meetings = {
//   "reunion123": {
//      encuestaActiva: false,
//      totalRespuestas: 0,
//      totalPersonas: 0,
//      participantes: Set()
//   }
// }

const meetings = new Map();

function obtenerReunion(meetingId) {
    if (!meetings.has(meetingId)) {
        meetings.set(meetingId, {
            encuestaActiva: false,
            totalRespuestas: 0,
            totalPersonas: 0,
            participantes: new Set()
        });
    }

    return meetings.get(meetingId);
}


// ------------------------------------
// CONEXIONES
// ------------------------------------

io.on("connection", (socket) => {

    console.log("✅ Cliente conectado:", socket.id);

    // Por ahora usamos un ID de prueba.
    // Más adelante Zoom nos dará el ID real de la reunión.
    const meetingId =
        socket.handshake.auth?.meetingId || "reunion-prueba";

    socket.join(meetingId);

    const reunion = obtenerReunion(meetingId);

    // Guardamos el ID de reunión asociado al socket
    socket.meetingId = meetingId;

    // Enviar estado actual
    socket.emit("estadoEncuesta", {
        encuestaActiva: reunion.encuestaActiva,
        totalRespuestas: reunion.totalRespuestas,
        totalPersonas: reunion.totalPersonas,
        yaRespondio: reunion.participantes.has(socket.id)
    });


    // --------------------------------
    // ENVIAR RESPUESTA
    // --------------------------------

    socket.on("enviarRespuesta", (cantidad) => {

        const reunionActual =
            obtenerReunion(socket.meetingId);

        if (!reunionActual.encuestaActiva) {
            socket.emit(
                "errorEncuesta",
                "La encuesta no está activa."
            );
            return;
        }

        // Una respuesta por conexión durante esta prueba
        if (reunionActual.participantes.has(socket.id)) {
            socket.emit(
                "errorEncuesta",
                "Ya enviaste tu respuesta."
            );
            return;
        }

        const numero = Number(cantidad);

        if (
            !Number.isInteger(numero) ||
            numero < 1 ||
            numero > 10
        ) {
            socket.emit(
                "errorEncuesta",
                "Respuesta inválida."
            );
            return;
        }

        reunionActual.participantes.add(socket.id);

        reunionActual.totalRespuestas++;
        reunionActual.totalPersonas += numero;

        console.log(
            `📝 Reunión ${socket.meetingId} | ` +
            `Respuesta: ${numero} | ` +
            `Respuestas: ${reunionActual.totalRespuestas} | ` +
            `Total: ${reunionActual.totalPersonas}`
        );

        io.to(socket.meetingId).emit(
            "resultadosActualizados",
            {
                totalRespuestas:
                    reunionActual.totalRespuestas,

                totalPersonas:
                    reunionActual.totalPersonas
            }
        );

        socket.emit(
            "respuestaAceptada",
            {
                cantidad: numero
            }
        );
    });


    // --------------------------------
    // LANZAR ENCUESTA
    // --------------------------------

    socket.on("lanzarEncuesta", () => {

        const reunionActual =
            obtenerReunion(socket.meetingId);

        reunionActual.encuestaActiva = true;

        reunionActual.totalRespuestas = 0;
        reunionActual.totalPersonas = 0;
        reunionActual.participantes.clear();

        console.log(
            `🚀 Encuesta lanzada en ${socket.meetingId}`
        );

        io.to(socket.meetingId).emit(
            "encuestaLanzada"
        );

        io.to(socket.meetingId).emit(
            "resultadosActualizados",
            {
                totalRespuestas: 0,
                totalPersonas: 0
            }
        );
    });


    // --------------------------------
    // CERRAR ENCUESTA
    // --------------------------------

    socket.on("cerrarEncuesta", () => {

        const reunionActual =
            obtenerReunion(socket.meetingId);

        reunionActual.encuestaActiva = false;

        console.log(
            `🛑 Encuesta cerrada en ${socket.meetingId}. ` +
            `Total: ${reunionActual.totalPersonas}`
        );

        io.to(socket.meetingId).emit(
            "encuestaCerrada"
        );
    });


    // --------------------------------
    // DESCONECTAR
    // --------------------------------

    socket.on("disconnect", () => {

        console.log(
            "❌ Cliente desconectado:",
            socket.id
        );
    });

});


// ------------------------------------
// INICIAR SERVIDOR
// ------------------------------------

server.listen(PORT, () => {

    console.log("");
    console.log("====================================");
    console.log("     SERVIDOR ENCUESTA ZOOM");
    console.log("====================================");
    console.log("");
    console.log(`✅ Puerto: ${PORT}`);
    console.log("");
});