// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE
// ==========================================
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
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserRole = '';

// ==========================================
// 2. UI, NAVEGACIÓN Y MENÚ MÓVIL
// ==========================================
function mostrarNotificacion(mensaje, tipo = 'success') {
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    Toast.fire({ icon: tipo, title: mensaje });
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function navegarMódulo(moduloId) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.module-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`btn-${moduloId}`).classList.add('active');
    document.getElementById(`mod-${moduloId}`).classList.add('active');
    
    if(moduloId === 'agenda') cargarDatosCalendario();
    if(moduloId === 'pacientes') cargarDirectorioPacientes();

    // Cierra el menú automáticamente al tocar una opción en el celular
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }
}

// ==========================================
// 3. AUTENTICACIÓN
// ==========================================
async function loginUsuario(e) {
    e.preventDefault();
    try { await auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value); } 
    catch (e) { Swal.fire('Error', 'Credenciales incorrectas.', 'error'); }
}
function logoutUsuario() { auth.signOut(); }

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const docUser = await db.collection('usuarios').doc(user.uid).get();
        currentUserRole = docUser.exists ? docUser.data().rol : 'doctor';
        if (!docUser.exists) await db.collection('usuarios').doc(user.uid).set({ rol: 'doctor', email: user.email, nombre: 'Dr. Principal' });
        const userData = docUser.exists ? docUser.data() : { nombre: 'Dr. Principal' };

        document.getElementById('header-nombre').innerText = userData.nombre || user.email;
        document.getElementById('header-rol').innerText = currentUserRole === 'doctor' ? (userData.especialidad || 'Médico Especialista') : 'Enfermería';
        if(userData.fotoUrl) document.getElementById('header-avatar').src = userData.fotoUrl;
        document.getElementById('perfil-nombre').value = userData.nombre || '';
        
        if(currentUserRole === 'doctor') {
            document.getElementById('perfil-cedula').value = userData.cedula || '';
            document.getElementById('perfil-especialidad').value = userData.especialidad || '';
            document.getElementById('btn-agenda').style.display = 'block';
            document.getElementById('btn-pacientes').style.display = 'block';
            document.getElementById('btn-asistencia').style.display = 'block';
            document.getElementById('campos-doctor').style.display = 'block';
        } else {
            document.querySelectorAll('#btn-agenda, #btn-pacientes, #btn-asistencia, #campos-doctor').forEach(el => el.style.display = 'none');
            navegarMódulo('espera'); 
        }
        document.getElementById('view-login').style.display = 'none';
        document.getElementById('view-dashboard').style.display = 'flex';
        cargarCitas();
    } else {
        document.getElementById('view-login').style.display = 'flex';
        document.getElementById('view-dashboard').style.display = 'none';
    }
});

// ==========================================
// 4. MÓDULO PERFIL 
// ==========================================
function comprimirImagen(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); let w = img.width, h = img.height;
                if (w > h && w > maxWidth) { h *= maxWidth / w; w = maxWidth; } else if (h > maxHeight) { w *= maxHeight / h; h = maxHeight; }
                canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality)); 
            };
        };
    });
}
function solicitarGuardarPerfil() {
    Swal.fire({ title: 'Confirmar', text: "Ingresa tu contraseña:", input: 'password', showCancelButton: true }).then((r) => { if (r.isConfirmed && r.value) guardarPerfilReal(r.value); });
}
async function guardarPerfilReal(password) {
    try { await auth.signInWithEmailAndPassword(auth.currentUser.email, password); } catch(e) { Swal.fire('Error', 'Pass incorrecto.', 'error'); return; }
    const updateData = { nombre: document.getElementById('perfil-nombre').value };
    if(currentUserRole === 'doctor') { updateData.cedula = document.getElementById('perfil-cedula').value; updateData.especialidad = document.getElementById('perfil-especialidad').value; }
    const fotoInput = document.getElementById('perfil-foto');
    if (fotoInput.files.length > 0) updateData.fotoUrl = await comprimirImagen(fotoInput.files[0], 200, 200, 0.6);
    await db.collection('usuarios').doc(auth.currentUser.uid).update(updateData);
    document.getElementById('header-nombre').innerText = updateData.nombre;
    if(currentUserRole === 'doctor') document.getElementById('header-rol').innerText = updateData.especialidad;
    Swal.fire('¡Éxito!', 'Perfil actualizado.', 'success');
}

// ==========================================
// 5. SALA DE ESPERA
// ==========================================
function cargarCitas() {
    const hoyStr = new Date().toISOString().split('T')[0];
    db.collection('citas').where('fecha', '>=', hoyStr).onSnapshot(snap => {
        const lista = document.getElementById('lista-citas'); lista.innerHTML = '';
        let citasHoy = [];
        snap.forEach(doc => { if (doc.data().estado !== 'Completada') citasHoy.push({id: doc.id, ...doc.data()}); });
        citasHoy.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
        citasHoy.forEach(c => {
            const div = document.createElement('div'); div.className = 'card'; div.style.marginBottom = '15px'; div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center'; div.style.flexWrap = 'wrap';
            let botones = c.signosVitales ? `<span style="color:#10b981;font-weight:bold;">✅ Signos Listos</span>` : `<button onclick="abrirModalVitals('${c.id}')" class="btn-signos" style="margin-top: 5px;">🩺 Tomar Signos</button>`;
            if (currentUserRole === 'doctor') botones += `<button onclick="abrirModalConsulta('${c.id}')" class="btn-primary" style="width:auto;margin-left:10px;padding:6px 12px;font-size:12px;background:#0284c7;margin-top:5px;">Atender</button>`;
            div.innerHTML = `<div style="flex: 1; min-width: 200px;"><strong>${c.nombre}</strong> <small>(${c.telefono})</small><br><span style="font-size:13px;">${c.motivo}</span><div style="margin-top:8px;">${botones}</div></div><div style="text-align:right; flex: 1; min-width: 100px; margin-top: 10px;"><b>${c.hora}</b><br><small>${c.fecha}</small></div>`;
            lista.appendChild(div);
        });
    });
}
function formatearFechaInvertida(f) { const p = f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function calcularEdad(f) {
    if(!f) return 'N/D';
    const h = new Date(); const c = new Date(f); let e = h.getFullYear() - c.getFullYear();
    const m = h.getMonth() - c.getMonth(); if (m < 0 || (m === 0 && h.getDate() < c.getDate())) e--;
    return e;
}

// ==========================================
// 6. GENERADOR DE EXPEDIENTES Y SIGNOS
// ==========================================
async function generarNumeroExpediente() {
    const snap = await db.collection('pacientes').get();
    const total = snap.size + 1;
    const year = new Date().getFullYear();
    return `EXP-${year}-${String(total).padStart(4, '0')}`;
}

async function pedirDatosNuevoPaciente(nombreInicial) {
    const { value: formValues } = await Swal.fire({
        title: 'Crear Expediente Médico',
        html: `
            <label style="font-size:12px;display:block;text-align:left;">Nombre Real del Paciente</label>
            <input id="swal-nom" class="swal2-input" type="text" value="${nombreInicial}" style="margin-top:5px; margin-bottom:15px;">
            <label style="font-size:12px;display:block;text-align:left;">Fecha de Nacimiento</label>
            <input id="swal-nac" class="swal2-input" type="date" style="margin-top:5px; margin-bottom:15px;">
            <label style="font-size:12px;display:block;text-align:left;">Sexo</label>
            <select id="swal-sexo" class="swal2-input" style="margin-top:5px;">
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
            </select>
        `,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'Crear Expediente',
        preConfirm: () => {
            const nom = document.getElementById('swal-nom').value;
            const nac = document.getElementById('swal-nac').value;
            const sexo = document.getElementById('swal-sexo').value;
            if (!nom || !nac) { Swal.showValidationMessage('Nombre y fecha obligatorios'); return false; }
            return { nombre: nom, nacimiento: nac, sexo: sexo };
        }
    });
    return formValues;
}

async function abrirModalVitals(idCita) {
    const docCita = await db.collection('citas').doc(idCita).get();
    document.getElementById('vitals-cita-id').value = idCita;
    document.getElementById('vitals-paciente-nombre').innerText = `Cita a nombre de: ${docCita.data().nombre}`;
    document.getElementById('modal-vitals').style.display = 'flex';
}

function cerrarModalVitals() { document.getElementById('modal-vitals').style.display = 'none'; }

async function guardarSignosVitales(e) {
    e.preventDefault();
    const idCita = document.getElementById('vitals-cita-id').value;
    const docCita = await db.collection('citas').doc(idCita).get();
    const cita = docCita.data();

    const signos = {
        peso: document.getElementById('vit-peso').value, estatura: document.getElementById('vit-estatura').value,
        presion: document.getElementById('vit-presion').value, temperatura: document.getElementById('vit-temp').value,
        frecuenciaCardiaca: document.getElementById('vit-fc').value, registradoEn: firebase.firestore.FieldValue.serverTimestamp()
    };

    let pacienteIdFinal = cita.pacienteId || null;
    let nombreFinal = cita.nombre; 

    if (!pacienteIdFinal) {
        const pacientesSnap = await db.collection('pacientes').where('telefono', '==', cita.telefono).get();

        if (pacientesSnap.empty) {
            const pData = await pedirDatosNuevoPaciente(cita.nombre);
            if(!pData) return; 
            const numExp = await generarNumeroExpediente();
            const newDoc = await db.collection('pacientes').add({
                numExpediente: numExp, telefono: cita.telefono, nombre: pData.nombre, nacimiento: pData.nacimiento, sexo: pData.sexo, creadoEn: firebase.firestore.FieldValue.serverTimestamp()
            });
            pacienteIdFinal = newDoc.id; 
            nombreFinal = pData.nombre;
        } else {
            let opciones = {};
            pacientesSnap.forEach(d => { opciones[d.id] = `[${d.data().numExpediente || 'S/N'}] ${d.data().nombre} (${calcularEdad(d.data().nacimiento)} años)`; });
            opciones['NUEVO'] = '+ Crear un familiar nuevo';

            const { value: seleccion } = await Swal.fire({
                title: 'Familia Detectada',
                text: `El número ${cita.telefono} tiene estos expedientes. ¿Quién es el paciente?`,
                input: 'select', inputOptions: opciones, showCancelButton: true, confirmButtonText: 'Seleccionar'
            });

            if(!seleccion) return;

            if(seleccion === 'NUEVO') {
                const pData = await pedirDatosNuevoPaciente(cita.nombre);
                if(!pData) return;
                const numExp = await generarNumeroExpediente();
                const newDoc = await db.collection('pacientes').add({
                    numExpediente: numExp, telefono: cita.telefono, nombre: pData.nombre, nacimiento: pData.nacimiento, sexo: pData.sexo, creadoEn: firebase.firestore.FieldValue.serverTimestamp()
                });
                pacienteIdFinal = newDoc.id;
                nombreFinal = pData.nombre;
            } else {
                pacienteIdFinal = seleccion; 
                const familiarDoc = await db.collection('pacientes').doc(seleccion).get();
                nombreFinal = familiarDoc.data().nombre;
            }
        }
    }

    await db.collection('citas').doc(idCita).update({ 
        signosVitales: signos, pacienteId: pacienteIdFinal, nombre: nombreFinal 
    });

    cerrarModalVitals(); e.target.reset();
    mostrarNotificacion('Signos guardados y expediente asignado');
}

// ==========================================
// 7. CONSULTA MÉDICA (DR) Y PDF
// ==========================================
async function abrirModalConsulta(citaId) {
    const docCita = await db.collection('citas').doc(citaId).get();
    const cita = docCita.data();
    let p = null; let edad = 'N/D';

    if (cita.pacienteId) {
        const docP = await db.collection('pacientes').doc(cita.pacienteId).get();
        if(docP.exists) { p = docP.data(); edad = calcularEdad(p.nacimiento); }
    } 

    document.getElementById('cons-cita-id').value = citaId;
    
    if (p) {
        document.getElementById('cons-paciente-nombre').innerText = `Atendiendo a: ${p.nombre} (${edad} años)`;
        document.getElementById('cons-signos-vitales').innerHTML = `
            <div style="background:#f1f5f9; padding:10px; border-radius:8px; font-size:13px;">
                <b>Expediente:</b> <span style="color:var(--primary); font-weight:bold;">${p.numExpediente || 'S/N'}</span> | ${p.sexo} | Nacimiento: ${formatearFechaInvertida(p.nacimiento)}<br>
                <hr style="margin:8px 0; border:0; border-top:1px solid #ddd;">
                <b>Signos Tomados:</b> Peso: ${cita.signosVitales?.peso||'--'}kg | P.A: ${cita.signosVitales?.presion||'--'} | Temp: ${cita.signosVitales?.temperatura||'--'}°C
            </div>`;
    } else {
        document.getElementById('cons-paciente-nombre').innerText = `Atendiendo a: ${cita.nombre}`;
        document.getElementById('cons-signos-vitales').innerHTML = "<span style='color:var(--danger);'>⚠️ El paciente no tiene expediente asignado. Faltan signos.</span>";
    }
    document.getElementById('modal-consulta').style.display = 'flex';
}
function cerrarModalConsulta() { document.getElementById('modal-consulta').style.display = 'none'; }

async function guardarConsulta(e) {
    e.preventDefault();
    const id = document.getElementById('cons-cita-id').value;
    const diag = document.getElementById('cons-diagnostico').value;
    const receta = document.getElementById('cons-receta').value;
    const docCita = await db.collection('citas').doc(id).get();
    const cita = docCita.data();

    let expNum = 'S/N';
    if(cita.pacienteId){
        const docP = await db.collection('pacientes').doc(cita.pacienteId).get();
        expNum = docP.data().numExpediente || 'S/N';
    }

    await db.collection('citas').doc(id).update({ diagnostico: diag, receta: receta, estado: 'Completada' });
    generarPDF(cita.nombre, diag, receta, cita.fecha, expNum);
    cerrarModalConsulta(); e.target.reset();
    Swal.fire('¡Listo!', 'Consulta finalizada y guardada en el historial.', 'success');
}

function generarPDF(n, d, r, f, expNum) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'l', unit: 'in', format: [5.5, 8.5] });
    const fImp = f ? formatearFechaInvertida(f) : new Date().toLocaleDateString();
    doc.setFontSize(16); doc.setTextColor(14, 165, 233); doc.text("RECETA MÉDICA", 0.5, 0.8);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.text(`Paciente: ${n}`, 0.5, 1.2); 
    doc.text(`Fecha: ${fImp}`, 6.0, 1.2); 
    if(expNum) doc.text(`Expediente: ${expNum}`, 6.0, 1.4); 
    doc.line(0.5, 1.5, 8.0, 1.5);
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text("DIAGNÓSTICO:", 0.5, 1.9); doc.setFont(undefined, 'normal'); doc.setFontSize(10); doc.text(doc.splitTextToSize(d, 7.5), 0.5, 2.1);
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text("TRATAMIENTO:", 0.5, 2.9); doc.setFont(undefined, 'normal'); doc.setFontSize(10); doc.text(doc.splitTextToSize(r, 7.5), 0.5, 3.1);
    doc.line(5.5, 4.8, 7.5, 4.8); doc.text("Firma del Médico Tratante", 6.5, 5.0, {align: 'center'});
    doc.save(`Receta_${n.replace(/\s+/g, '_')}.pdf`);
}

// ==========================================
// 8. DIRECTORIO DE PACIENTES MAESTRO
// ==========================================
async function cargarDirectorioPacientes() {
    const lista = document.getElementById('lista-busqueda');
    lista.innerHTML = '<p>Cargando pacientes...</p>';
    const snap = await db.collection('pacientes').orderBy('nombre').get();
    const pacientes = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
    renderizarListaPacientes(pacientes);
}

async function buscarPaciente() {
    const b = document.getElementById('busqueda-paciente').value.toLowerCase();
    if (!b) { cargarDirectorioPacientes(); return; }
    const snap = await db.collection('pacientes').get();
    const filtrados = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => 
        p.nombre.toLowerCase().includes(b) || p.telefono.includes(b) || (p.numExpediente && p.numExpediente.toLowerCase().includes(b))
    );
    renderizarListaPacientes(filtrados);
}

function renderizarListaPacientes(arr) {
    const lista = document.getElementById('lista-busqueda'); lista.innerHTML = '';
    arr.forEach(p => {
        const div = document.createElement('div'); div.className = 'card'; div.style.marginBottom = '10px'; div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center'; div.style.flexWrap = 'wrap';
        div.innerHTML = `<div style="flex:1; min-width: 200px;"><strong>${p.nombre}</strong> <span style="color:var(--primary); font-size:12px; font-weight:bold;">[${p.numExpediente || 'S/N'}]</span><br><small>Tel: ${p.telefono} | Sexo: ${p.sexo}</small></div><button onclick="verHistorial('${p.id}', '${p.nombre}', '${p.nacimiento}', '${p.sexo}', '${p.numExpediente}')" class="btn-secondary" style="width:auto;padding:5px 15px; margin-top: 10px;">Ver Historial</button>`;
        lista.appendChild(div);
    });
}

async function verHistorial(pacienteId, nom, nac, sex, expNum) {
    const snap = await db.collection('citas').where('pacienteId', '==', pacienteId).where('estado', '==', 'Completada').get();
    let h = `<div style="background:#f1f5f9;padding:10px;border-radius:8px;margin-bottom:15px;font-size:13px;"><b>Expediente:</b> ${expNum || 'S/N'} | <b>Edad:</b> ${calcularEdad(nac)} | <b>Sexo:</b> ${sex}</div><div style="text-align:left;max-height:350px;overflow-y:auto;">`;
    if(snap.empty) h += `<p>No hay consultas registradas para este paciente.</p>`; else {
        snap.docs.forEach(doc => { 
            const c = doc.data();
            h += `<div style="padding:10px;border-left:4px solid #0ea5e9;background:#fff;margin-bottom:10px;border:1px solid #eee;">
                <div style="display:flex;justify-content:space-between; flex-wrap: wrap;"><strong>${formatearFechaInvertida(c.fecha)}</strong> <button onclick="generarPDF('${nom}','${c.diagnostico.replace(/'/g,"")}', '${c.receta.replace(/'/g,"")}', '${c.fecha}', '${expNum}')" style="font-size:10px;padding:4px 8px; margin-top: 5px;">Imprimir</button></div>
                <small><b>Diag:</b> ${c.diagnostico}</small></div>`;
        });
    }
    Swal.fire({ title: `Historial`, html: h + `</div>`, width: 600 });
}

// ==========================================
// 9. STAFF Y AGENDA (CALENDARIO)
// ==========================================
async function crearPersonal(e) { e.preventDefault(); const rol = document.getElementById('staff-rol').value, nom = document.getElementById('staff-nombre').value, email = document.getElementById('staff-email').value, pass = document.getElementById('staff-password').value; try { const n = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass); await db.collection('usuarios').doc(n.user.uid).set({ nombre: nom, email: email, rol: rol }); await secondaryApp.auth().signOut(); Swal.fire('Éxito', 'Personal creado', 'success'); } catch(e) { Swal.fire('Error', 'Verifica datos', 'error'); } }
let fechaNav = new Date(); let fechaSeleccionada = null; let citasDelMes = []; let bloqueosDelMes = [];
function cambiarMes(delta) { fechaNav.setMonth(fechaNav.getMonth() + delta); cargarDatosCalendario(); }
async function cargarDatosCalendario() { const year = fechaNav.getFullYear(), month = fechaNav.getMonth(); const p = `${year}-${String(month + 1).padStart(2, '0')}-01`, u = `${year}-${String(month + 1).padStart(2, '0')}-31`; const cSnap = await db.collection('citas').where('fecha', '>=', p).where('fecha', '<=', u).get(); citasDelMes = cSnap.docs.map(d => d.data()); const bSnap = await db.collection('bloqueos').where('fecha', '>=', p).where('fecha', '<=', u).get(); bloqueosDelMes = bSnap.docs.map(d => d.data()); dibujarCalendario(); }
function dibujarCalendario() { const year = fechaNav.getFullYear(), month = fechaNav.getMonth(); document.getElementById('mes-actual').innerText = fechaNav.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); const grid = document.getElementById('calendario-body'); grid.innerHTML = ''; const p = new Date(year, month, 1).getDay(), d = new Date(year, month + 1, 0).getDate(); for (let i = 0; i < p; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'dia-celda vacio'})); for (let i = 1; i <= d; i++) { const s = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`, div = document.createElement('div'); div.className = 'dia-celda'; div.innerText = i; if (s === new Date().toISOString().split('T')[0]) div.classList.add('hoy'); if (s === fechaSeleccionada) div.classList.add('seleccionado'); if (citasDelMes.some(c => c.fecha === s)) div.appendChild(Object.assign(document.createElement('div'), {className: 'dot-cita'})); if (bloqueosDelMes.some(b => b.fecha === s && b.horas.length >= 10)) div.classList.add('bloqueado'); div.onclick = () => seleccionarDiaCalendario(s, i, citasDelMes.filter(c => c.fecha === s), bloqueosDelMes.find(b => b.fecha === s)); grid.appendChild(div); } }
function seleccionarDiaCalendario(s, i, c, b) { fechaSeleccionada = s; dibujarCalendario(); document.getElementById('dia-detalle-titulo').innerText = new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); const p = document.getElementById('panel-citas-dia'); p.innerHTML = c.length ? c.map(x => `<div style="font-size:13px;border-bottom:1px solid #eee;padding:5px;"><b>${x.hora}</b> - ${x.nombre}</div>`).join('') : 'Sin citas'; if (currentUserRole === 'doctor') { document.getElementById('panel-bloqueos').style.display = 'block'; dibujarHorasBloqueo(b ? b.horas : []); } }
const TODAS_LAS_HORAS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"];
function dibujarHorasBloqueo(b) { const c = document.getElementById('lista-horas-bloqueo'); c.innerHTML = TODAS_LAS_HORAS.map(h => `<button class="hora-btn ${b?.includes(h) ? 'bloqueada' : ''}" onclick="this.classList.toggle('bloqueada')">${h}</button>`).join(''); }
async function guardarBloqueosDia() { const h = Array.from(document.querySelectorAll('.hora-btn.bloqueada')).map(x => x.innerText); try { if (!h.length) await db.collection('bloqueos').doc(fechaSeleccionada).delete(); else await db.collection('bloqueos').doc(fechaSeleccionada).set({ fecha: fechaSeleccionada, horas: h }); Swal.fire('Ok', 'Agenda actualizada', 'success'); cargarDatosCalendario(); } catch(e) {} }
