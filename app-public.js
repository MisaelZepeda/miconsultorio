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
        errorFecha.style.display = 'block'; 
        selectHora.innerHTML = '<option value="">Seleccione otra fecha</option>'; 
        selectHora.disabled = true; 
        return; 
    }
    errorFecha.style.display = 'none';

    selectHora.innerHTML = '<option value="">Cargando horarios...</option>';
    selectHora.disabled = true;

    const snapshot = await db.collection('citas').where('fecha', '==', fechaSeleccionada).get();
    const citasOcupadas = snapshot.docs.map(doc => doc.data().hora);
    const bloqueosSnap = await db.collection('bloqueos').doc(fechaSeleccionada).get();
    const horasBloqueadas = bloqueosSnap.exists ? bloqueosSnap.data().horas : [];

    selectHora.innerHTML = '<option value="">Seleccione una hora</option>';
    selectHora.disabled = false;

    let horaActual = CONFIG_HORARIO.inicio;
    let minutoActual = 0;

    while (horaActual < CONFIG_HORARIO.fin || (horaActual === CONFIG_HORARIO.fin && minutoActual === 0)) {
        const horaFormateada = `${String(horaActual).padStart(2, '0')}:${String(minutoActual).padStart(2, '0')}`;
        
        if (!citasOcupadas.includes(horaFormateada) && !horasBloqueadas.includes(horaFormateada)) {
            const option = document.createElement('option'); 
            option.value = horaFormateada; 
            option.textContent = horaFormateada; 
            selectHora.appendChild(option);
        }
        
        minutoActual += CONFIG_HORARIO.intervalo;
        if (minutoActual >= 60) { minutoActual = 0; horaActual++; }
    }
    
    if (selectHora.options.length === 1) { 
        selectHora.innerHTML = '<option value="">Agenda llena / No disponible</option>'; 
        selectHora.disabled = true; 
    }
}

async function agendarCita(e) {
    e.preventDefault();
    const btn = document.querySelector('#form-agendar button'); 
    btn.innerText = "Agendando..."; 
    btn.disabled = true;

    // UNIFICACIÓN DE CAMPOS Y FORZADO DE MAYÚSCULAS
    const nom = document.getElementById('paciente-nombre').value.trim().toUpperCase();
    const ap1 = document.getElementById('paciente-ap1').value.trim().toUpperCase();
    const ap2 = document.getElementById('paciente-ap2').value.trim().toUpperCase();
    const motivo = document.getElementById('paciente-motivo').value.trim().toUpperCase();
    const nombreCompleto = [nom, ap1, ap2].filter(Boolean).join(' ');

    const citaObj = {
        nombre: nombreCompleto,
        nombrePila: nom, 
        apellido1: ap1, 
        apellido2: ap2,
        nacimiento: document.getElementById('paciente-nacimiento').value,
        sexo: document.getElementById('paciente-sexo').value,
        telefono: document.getElementById('paciente-telefono').value,
        fecha: document.getElementById('paciente-fecha').value, 
        hora: document.getElementById('paciente-hora').value,
        motivo: motivo, 
        estado: 'Pendiente', 
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('citas').add(citaObj); 
        // Cambiamos el alert() por SweetAlert2
        Swal.fire({
            icon: 'success',
            title: '¡Cita Confirmada!',
            text: 'Tu cita ha sido agendada con éxito en el sistema.',
            confirmButtonColor: '#0ea5e9'
        });
        
        document.getElementById('form-agendar').reset();
        document.getElementById('paciente-hora').innerHTML = '<option value="">Seleccione una fecha primero</option>'; 
        document.getElementById('paciente-hora').disabled = true;
    } catch (error) { 
        Swal.fire('Error', 'Hubo un error de conexión al guardar la cita. Inténtalo de nuevo.', 'error');
    } finally { 
        btn.innerText = "Confirmar Cita"; 
        btn.disabled = false; 
    }
}