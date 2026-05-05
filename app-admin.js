// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBYHog4jJ0NlQSf3YHXj09PjsZnNjtXLA0",
    authDomain: "consultoriomedico-d5b62.firebaseapp.com",
    projectId: "consultoriomedico-d5b62",
    storageBucket: "consultoriomedico-d5b62.firebasestorage.app",
    messagingSenderId: "1009151292704",
    appId: "1:1009151292704:web:21910d10043376da1c5345"
};

firebase.initializeApp(firebaseConfig);
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserRole = '';

// ==========================================
// 2. UTILIDADES DE UI (SWEETALERT) Y NAVEGACIÓN
// ==========================================
function mostrarNotificacion(mensaje, tipo = 'success') {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
    Toast.fire({ icon: tipo, title: mensaje });
}

function navegarMódulo(moduloId) {
    // Apaga todos los botones y secciones
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.module-section').forEach(sec => sec.classList.remove('active'));
    
    // Prende solo el que se seleccionó
    document.getElementById(`btn-${moduloId}`).classList.add('active');
    document.getElementById(`mod-${moduloId}`).classList.add('active');
}

// ==========================================
// 3. AUTENTICACIÓN Y SEGURIDAD DE ROLES
// ==========================================
async function loginUsuario(e) {
    e.preventDefault();
    try {
        await auth.signInWithEmailAndPassword(
            document.getElementById('login-email').value, 
            document.getElementById('login-password').value
        );
    } catch (e) { 
        Swal.fire('Error', 'Credenciales incorrectas.', 'error'); 
    }
}

function logoutUsuario() { 
    auth.signOut(); 
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const docUser = await db.collection('usuarios').doc(user.uid).get();
        currentUserRole = docUser.exists ? docUser.data().rol : 'doctor';
        
        // Si el usuario no existe en la base de datos (fue creado desde la consola), lo guardamos como doctor
        if (!docUser.exists) {
            await db.collection('usuarios').doc(user.uid).set({ rol: 'doctor', email: user.email, nombre: 'Dr. Principal' });
        }

        const userData = docUser.exists ? docUser.data() : { nombre: 'Dr. Principal' };

        // Actualizar datos visuales de la Cabecera (Header)
        document.getElementById('header-nombre').innerText = userData.nombre || user.email;
        document.getElementById('header-rol').innerText = currentUserRole === 'doctor' ? 'Médico Especialista' : 'Enfermería';

        // Configurar el menú según el Rol
        if (currentUserRole === 'doctor') {
            document.getElementById('btn-agenda').style.display = 'block';
            document.getElementById('btn-pacientes').style.display = 'block';
            document.getElementById('btn-asistencia').style.display = 'block';
        } else {
            // Si es enfermera, ocultamos lo que no debe ver
            document.getElementById('btn-agenda').style.display = 'none';
            document.getElementById('btn-pacientes').style.display = 'none';
            document.getElementById('btn-asistencia').style.display = 'none';
            navegarMódulo('espera'); // Forzamos a que inicie en la sala de espera
        }

        document.getElementById('view-login').style.display = 'none';
        document.getElementById('view-dashboard').style.display = 'flex';
        cargarCitas();
        mostrarNotificacion('Sesión iniciada correctamente');
    } else {
        document.getElementById('view-login').style.display = 'flex';
        document.getElementById('view-dashboard').style.display = 'none';
    }
});

// ==========================================
// 4. SALA DE ESPERA (Agenda del Día)
// ==========================================
function cargarCitas() {
    db.collection('citas').orderBy('fecha', 'asc').onSnapshot(snap => {
        const lista = document.getElementById('lista-citas');
        lista.innerHTML = '';
        let contador = 0;

        snap.forEach(doc => {
            const c = doc.data();
            // Ocultamos a los que ya fueron atendidos
            if (c.estado === 'Completada') return;
            contador++;

            const div = document.createElement('div');
            div.className = 'card';
            div.style.marginBottom = '15px';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';

            let botonesHTML = c.signosVitales 
                ? `<span style="color: #10b981; font-size: 12px; font-weight: bold; margin-right: 10px;">✅ Signos Registrados</span>`
                : `<button onclick="abrirModalVitals('${doc.id}', '${c.nombre}')" class="btn-signos" style="margin-right: 10px;">🩺 Tomar Signos</button>`;

            if (currentUserRole === 'doctor') {
                botonesHTML += `<button onclick="abrirModalConsulta('${doc.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 12px; width: auto; background-color: #0284c7;">👨‍⚕️ Atender</button>`;
            }

            div.innerHTML = `
                <div>
                    <strong style="font-size:16px;">${c.nombre}</strong> <span style="font-size:12px; color:var(--muted)">(${c.telefono})</span><br>
                    <span style="font-size: 14px;">Motivo: ${c.motivo}</span><br>
                    <div style="margin-top: 10px;">${botonesHTML}</div>
                </div>
                <div style="text-align: right;">
                    <small style="color: var(--muted);">${formatearFechaInvertida(c.fecha)}</small><br>
                    <strong style="font-size:18px; color:var(--primary);">${c.hora}</strong>
                </div>
            `;
            lista.appendChild(div);
        });

        if(contador === 0) {
            lista.innerHTML = '<p style="text-align:center; color:var(--muted);">No hay pacientes en sala de espera.</p>';
        }
    });
}

function formatearFechaInvertida(fechaYYYYMMDD) {
    if (!fechaYYYYMMDD) return "";
    const partes = fechaYYYYMMDD.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`; 
}

// ==========================================
// 5. MÓDULO: PACIENTES (Buscador y Expediente)
// ==========================================
async function buscarPaciente() {
    const busqueda = document.getElementById('busqueda-paciente').value.toLowerCase();
    const lista = document.getElementById('lista-busqueda');
    
    if (busqueda.length < 3) {
        lista.innerHTML = '<p style="color: var(--muted);">Escribe al menos 3 letras para buscar...</p>';
        return;
    }

    const snap = await db.collection('citas').get();
    lista.innerHTML = '';
    const encontrados = [];
    
    snap.forEach(doc => {
        const c = doc.data();
        if ((c.nombre.toLowerCase().includes(busqueda) || c.telefono.includes(busqueda)) && !encontrados.includes(c.telefono)) {
            encontrados.push(c.telefono);
            const div = document.createElement('div');
            div.className = 'card';
            div.style.marginBottom = '10px';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <div><strong>${c.nombre}</strong><br><small>Tel: ${c.telefono}</small></div>
                <button onclick="verHistorial('${c.telefono}', '${c.nombre}')" class="btn-secondary" style="width:auto; padding: 5px 15px;">Ver Expediente</button>
            `;
            lista.appendChild(div);
        }
    });
    
    if(encontrados.length === 0) lista.innerHTML = '<p>No se encontraron pacientes.</p>';
}

async function verHistorial(telefono, nombre) {
    // Traemos todas las consultas pasadas del paciente
    const snap = await db.collection('citas').where('telefono', '==', telefono).where('estado', '==', 'Completada').get();
    let html = `<div style="text-align: left; max-height: 400px; overflow-y: auto;">`;
    
    if(snap.empty) {
        html += `<p>No hay consultas previas registradas.</p>`;
    } else {
        snap.forEach(doc => {
            const c = doc.data();
            html += `
            <div style="padding: 15px; border-left: 4px solid var(--primary); background: #f1f5f9; margin-bottom: 10px; border-radius: 4px;">
                <strong style="color:var(--primary);">${formatearFechaInvertida(c.fecha)}</strong><br>
                <b>Diagnóstico:</b> ${c.diagnostico}<br>
                <b>Receta:</b> ${c.receta}
            </div>`;
        });
    }
    html += `</div>`;
    
    Swal.fire({
        title: `Expediente: ${nombre}`,
        html: html,
        width: 600,
        showCloseButton: true,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#0ea5e9'
    });
}

// ==========================================
// 6. MÓDULO: ASISTENCIA (Crear Personal)
// ==========================================
async function crearPersonal(e) {
    e.preventDefault();
    const rol = document.getElementById('staff-rol').value;
    const nombre = document.getElementById('staff-nombre').value;
    const email = document.getElementById('staff-email').value;
    const pass = document.getElementById('staff-password').value;

    try {
        Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        
        const newStaff = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
        await db.collection('usuarios').doc(newStaff.user.uid).set({
            nombre: nombre, email: email, rol: rol, creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
        await secondaryApp.auth().signOut();
        
        document.getElementById('form-staff').reset();
        Swal.fire('¡Éxito!', `Usuario ${nombre} creado como ${rol}.`, 'success');
    } catch (error) {
        Swal.fire('Error', 'No se pudo crear. Verifica que el correo no exista y la contraseña tenga 6+ letras.', 'error');
    }
}

// ==========================================
// 7. MÓDULO: PERFIL (Actualizar Datos)
// ==========================================
function solicitarGuardarPerfil() {
    Swal.fire({
        title: 'Confirmar Cambios',
        text: "Ingresa tu contraseña actual para guardar las modificaciones:",
        input: 'password',
        inputAttributes: { autocapitalize: 'off', placeholder: 'Tu contraseña' },
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0ea5e9',
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            // Por ahora simularemos el éxito. En el siguiente paso agregaremos la compresión de imagen.
            mostrarNotificacion('Perfil actualizado correctamente');
        }
    });
}

// ==========================================
// 8. TOMA DE SIGNOS VITALES
// ==========================================
function abrirModalVitals(id, nombre) {
    document.getElementById('vitals-cita-id').value = id;
    document.getElementById('vitals-paciente-nombre').innerText = `Paciente: ${nombre}`;
    document.getElementById('modal-vitals').style.display = 'flex';
}
function cerrarModalVitals() { document.getElementById('modal-vitals').style.display = 'none'; }

async function guardarSignosVitales(e) {
    e.preventDefault();
    const id = document.getElementById('vitals-cita-id').value;
    const signos = {
        peso: document.getElementById('vit-peso').value,
        estatura: document.getElementById('vit-estatura').value,
        presion: document.getElementById('vit-presion').value,
        temperatura: document.getElementById('vit-temp').value,
        frecuenciaCardiaca: document.getElementById('vit-fc').value,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('citas').doc(id).update({ signosVitales: signos });
    cerrarModalVitals();
    e.target.reset();
    mostrarNotificacion('Signos vitales registrados en el expediente');
}

// ==========================================
// 9. CONSULTA MÉDICA Y GENERACIÓN DE RECETA PDF
// ==========================================
async function abrirModalConsulta(citaId) {
    const doc = await db.collection('citas').doc(citaId).get();
    const c = doc.data();
    
    document.getElementById('cons-cita-id').value = citaId;
    document.getElementById('cons-paciente-nombre').innerText = `Atendiendo a: ${c.nombre}`;
    
    // Carga los signos si existen
    document.getElementById('cons-signos-vitales').innerHTML = c.signosVitales ? 
        `<b>Peso:</b> ${c.signosVitales.peso}kg | <b>Estatura:</b> ${c.signosVitales.estatura}m | <b>P.A:</b> ${c.signosVitales.presion} | <b>Temp:</b> ${c.signosVitales.temperatura}°C` 
        : "<span style='color:var(--danger);'>⚠️ La enfermera no registró signos</span>";
    
    document.getElementById('modal-consulta').style.display = 'flex';
}

function cerrarModalConsulta() { document.getElementById('modal-consulta').style.display = 'none'; }

async function guardarConsulta(e) {
    e.preventDefault();
    const id = document.getElementById('cons-cita-id').value;
    const diag = document.getElementById('cons-diagnostico').value;
    const receta = document.getElementById('cons-receta').value;

    const docRef = db.collection('citas').doc(id);
    const docSnap = await docRef.get();
    const datos = docSnap.data();

    // Guardar en Firebase y marcar como Completada
    await docRef.update({ diagnostico: diag, receta: receta, estado: 'Completada' });
    
    // Disparar la descarga del PDF
    generarPDF(datos.nombre, diag, receta);
    
    cerrarModalConsulta();
    e.target.reset();
    Swal.fire('¡Consulta Finalizada!', 'El expediente se ha guardado y la receta se está descargando.', 'success');
}

function generarPDF(nombre, diag, receta) {
    const { jsPDF } = window.jspdf;
    // Formato Media Carta Horizontal (5.5 x 8.5 pulgadas)
    const doc = new jsPDF({ orientation: 'l', unit: 'in', format: [5.5, 8.5] });

    // Diseño visual de la receta
    doc.setFontSize(16);
    doc.setTextColor(14, 165, 233); // Azul primario
    doc.text("RECETA MÉDICA", 0.5, 0.8);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Paciente: ${nombre}`, 0.5, 1.2);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 6.0, 1.2);
    doc.line(0.5, 1.3, 8.0, 1.3);

    // Diagnóstico
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("DIAGNÓSTICO:", 0.5, 1.7);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(diag, 7.5), 0.5, 1.9);

    // Tratamiento
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("TRATAMIENTO INDICADO:", 0.5, 2.7);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(receta, 7.5), 0.5, 2.9);

    // Firma del Médico
    doc.line(5.5, 4.8, 7.5, 4.8);
    doc.setFontSize(9);
    doc.text("Firma del Médico Tratante", 6.5, 5.0, {align: 'center'});

    // Descargar Archivo
    doc.save(`Receta_${nombre.replace(/\s+/g, '_')}.pdf`);
}