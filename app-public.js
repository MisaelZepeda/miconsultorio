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

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const CONFIG_HORARIO = { inicio: 9, fin: 14, intervalo: 30 };

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paciente-fecha').setAttribute('min', today);
});

async function validarFecha(fechaSeleccionada) {
    const dateObj = new Date(fechaSeleccionada + 'T00:00:00');
    const dia = dateObj.getDay(); 
    const selectHora = document.getElementById('paciente-hora');
    const errorFecha = document.getElementById('error-fecha');

    if (dia === 0 || dia === 6) {
        errorFecha.style.display = 'block'; selectHora.disabled = true; selectHora.innerHTML = '<option value="">Cerrado los fines de semana</option>'; return;
    }
    errorFecha.style.display = 'none'; selectHora.disabled = false; selectHora.innerHTML = '<option value="">Cargando horarios...</option>';

    let ocupadas = [];
    try {
        const snapshot = await db.collection('citas').where('fecha', '==', fechaSeleccionada).get();
        snapshot.forEach(doc => ocupadas.push(doc.data().hora));
        const docBloqueo = await db.collection('bloqueos').doc(fechaSeleccionada).get();
        if (docBloqueo.exists) ocupadas = ocupadas.concat(docBloqueo.data().horas); 
        generarIntervalos(ocupadas);
    } catch(error) {
        console.error("Error leyendo Firebase:", error);
        selectHora.innerHTML = '<option value="">Error al cargar horarios</option>';
    }
}

function generarIntervalos(ocupadas) {
    const selectHora = document.getElementById('paciente-hora');
    selectHora.innerHTML = '<option value="">Seleccione una hora</option>';
    let horaActual = CONFIG_HORARIO.inicio; let minutoActual = 0;

    while (horaActual < CONFIG_HORARIO.fin) {
        const horaFormateada = `${horaActual.toString().padStart(2, '0')}:${minutoActual.toString().padStart(2, '0')}`;
        if (!ocupadas.includes(horaFormateada)) {
            const option = document.createElement('option'); option.value = horaFormateada; option.textContent = horaFormateada; selectHora.appendChild(option);
        }
        minutoActual += CONFIG_HORARIO.intervalo;
        if (minutoActual >= 60) { minutoActual = 0; horaActual++; }
    }
    if (selectHora.options.length === 1) { selectHora.innerHTML = '<option value="">Agenda llena / No disponible</option>'; selectHora.disabled = true; }
}

async function agendarCita(e) {
    e.preventDefault();
    const btn = document.querySelector('#form-agendar button'); btn.innerText = "Agendando..."; btn.disabled = true;
    const citaObj = {
        nombre: document.getElementById('paciente-nombre').value, telefono: document.getElementById('paciente-telefono').value,
        fecha: document.getElementById('paciente-fecha').value, hora: document.getElementById('paciente-hora').value,
        motivo: document.getElementById('paciente-motivo').value, estado: 'Pendiente', creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await db.collection('citas').add(citaObj); alert('¡Tu cita ha sido agendada con éxito!');
        document.getElementById('form-agendar').reset();
        document.getElementById('paciente-hora').innerHTML = '<option value="">Seleccione una fecha primero</option>'; document.getElementById('paciente-hora').disabled = true;
    } catch (error) { alert('Hubo un error al guardar la cita.'); } finally { btn.innerText = "Confirmar Cita"; btn.disabled = false; }
}