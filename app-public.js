// 1. CONFIGURACIÓN DE FIREBASE (¡PEGA AQUÍ TUS CREDENCIALES NUEVAS!)
const firebaseConfig = {
  apiKey: "AIzaSyCFVUwEH23FHBdVy76rU7oVcmipCMqgpdo",
  authDomain: "consultorio-e7f0b.firebaseapp.com",
  databaseURL: "https://consultorio-e7f0b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "consultorio-e7f0b",
  storageBucket: "consultorio-e7f0b.firebasestorage.app",
  messagingSenderId: "926280104543",
  appId: "1:926280104543:web:fcd030ed328a7fdcf6f9ea",
  measurementId: "G-ESMSHBHN99"
};

// Inicializamos Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 2. CONFIGURACIÓN DEL HORARIO DEL DOCTOR
const CONFIG_HORARIO = {
    inicio: 9, // 9:00 AM
    fin: 14,   // 2:00 PM (14:00)
    intervalo: 30 // Citas de 30 minutos
};

// 3. BLOQUEAR FECHAS EN EL PASADO
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paciente-fecha').setAttribute('min', today);
});

// 4. VALIDAR DÍAS Y CARGAR HORARIOS DISPONIBLES
async function validarFecha(fechaSeleccionada) {
    const dateObj = new Date(fechaSeleccionada + 'T00:00:00');
    const dia = dateObj.getDay(); 
    
    const selectHora = document.getElementById('paciente-hora');
    const errorFecha = document.getElementById('error-fecha');

    // Bloquear Sábados (6) y Domingos (0)
    if (dia === 0 || dia === 6) {
        errorFecha.style.display = 'block';
        selectHora.disabled = true;
        selectHora.innerHTML = '<option value="">Cerrado los fines de semana</option>';
        return;
    }

    errorFecha.style.display = 'none';
    selectHora.disabled = false;
    selectHora.innerHTML = '<option value="">Cargando horarios...</option>';

    // Consultar a Firestore qué horas ya están ocupadas ese día
    const ocupadas = [];
    try {
        const snapshot = await db.collection('citas').where('fecha', '==', fechaSeleccionada).get();
        snapshot.forEach(doc => ocupadas.push(doc.data().hora));
        generarIntervalos(ocupadas);
    } catch(error) {
        console.error("Error leyendo Firebase:", error);
        selectHora.innerHTML = '<option value="">Error al cargar horarios</option>';
    }
}

// 5. GENERAR LA LISTA DE HORAS EXCLUYENDO LAS OCUPADAS
function generarIntervalos(ocupadas) {
    const selectHora = document.getElementById('paciente-hora');
    selectHora.innerHTML = '<option value="">Seleccione una hora</option>';

    let horaActual = CONFIG_HORARIO.inicio;
    let minutoActual = 0;

    while (horaActual < CONFIG_HORARIO.fin) {
        const hStr = horaActual.toString().padStart(2, '0');
        const mStr = minutoActual.toString().padStart(2, '0');
        const horaFormateada = `${hStr}:${mStr}`;

        // Si la hora NO está ocupada, la agregamos a la lista
        if (!ocupadas.includes(horaFormateada)) {
            const option = document.createElement('option');
            option.value = horaFormateada;
            option.textContent = horaFormateada;
            selectHora.appendChild(option);
        }

        minutoActual += CONFIG_HORARIO.intervalo;
        if (minutoActual >= 60) {
            minutoActual = 0;
            horaActual++;
        }
    }

    if (selectHora.options.length === 1) {
        selectHora.innerHTML = '<option value="">Agenda llena para este día</option>';
    }
}

// 6. GUARDAR LA CITA EN FIREBASE
async function agendarCita(e) {
    e.preventDefault();
    
    const citaObj = {
        nombre: document.getElementById('paciente-nombre').value,
        telefono: document.getElementById('paciente-telefono').value,
        fecha: document.getElementById('paciente-fecha').value,
        hora: document.getElementById('paciente-hora').value,
        motivo: document.getElementById('paciente-motivo').value,
        estado: 'Pendiente',
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('citas').add(citaObj);
        alert('¡Tu cita ha sido agendada con éxito!');
        document.getElementById('form-agendar').reset();
        document.getElementById('paciente-hora').innerHTML = '<option value="">Seleccione una fecha primero</option>';
        document.getElementById('paciente-hora').disabled = true;
    } catch (error) {
        console.error("Error al agendar:", error);
        alert('Hubo un error al guardar la cita. Intenta de nuevo.');
    }
}