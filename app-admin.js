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
// 2. UI Y NAVEGACIÓN
// ==========================================
function mostrarNotificacion(mensaje, tipo = 'success') {
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    Toast.fire({ icon: tipo, title: mensaje });
}

function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }

function navegarMódulo(moduloId) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.module-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`btn-${moduloId}`).classList.add('active');
    document.getElementById(`mod-${moduloId}`).classList.add('active');
    
    if(moduloId === 'agenda') cargarDatosCalendario();
    if(moduloId === 'pacientes') cargarDirectorioPacientes();
    if(moduloId === 'asistencia') cargarStaff();

    if (window.innerWidth <= 768) { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); }
}

// ==========================================
// 3. AUTENTICACIÓN Y PERFIL
// ==========================================
async function loginUsuario(e) { e.preventDefault(); try { await auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value); } catch (e) { Swal.fire('Error', 'Credenciales incorrectas.', 'error'); } }
function logoutUsuario() { auth.signOut(); }

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const docUser = await db.collection('usuarios').doc(user.uid).get();
        if(docUser.exists) {
            const data = docUser.data();
            if(data.estado === 'suspendido' || data.estado === 'eliminado') { await auth.signOut(); Swal.fire('Acceso Denegado', 'Su cuenta está inactiva.', 'error'); return; }
            currentUserRole = data.rol;
        } else {
            currentUserRole = 'doctor';
            await db.collection('usuarios').doc(user.uid).set({ rol: 'doctor', email: user.email, nombre: 'Dr. Principal', estado: 'activo' });
        }
        
        const userData = docUser.exists ? docUser.data() : { nombre: 'Dr. Principal' };

        document.getElementById('header-nombre').innerText = userData.nombre || user.email;
        document.getElementById('header-rol').innerText = currentUserRole === 'doctor' ? (userData.especialidad || 'Médico Especialista') : 'Enfermería';
        if(userData.fotoUrl) document.getElementById('header-avatar').src = userData.fotoUrl;
        document.getElementById('perfil-nombre').value = userData.nombre || '';
        
        if(currentUserRole === 'doctor') {
            document.getElementById('perfil-cedula').value = userData.cedula || ''; document.getElementById('perfil-especialidad').value = userData.especialidad || '';
            document.getElementById('btn-agenda').style.display = 'block'; document.getElementById('btn-pacientes').style.display = 'block'; document.getElementById('btn-asistencia').style.display = 'block'; document.getElementById('campos-doctor').style.display = 'block';
        } else {
            document.querySelectorAll('#btn-agenda, #btn-pacientes, #btn-asistencia, #campos-doctor').forEach(el => el.style.display = 'none'); navegarMódulo('espera'); 
        }
        document.getElementById('view-login').style.display = 'none'; document.getElementById('view-dashboard').style.display = 'flex'; cargarCitas();
    } else {
        document.getElementById('view-login').style.display = 'flex'; document.getElementById('view-dashboard').style.display = 'none';
    }
});

function comprimirImagen(file, maxWidth, maxHeight, quality) { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (e) => { const img = new Image(); img.src = e.target.result; img.onload = () => { const canvas = document.createElement('canvas'); let w = img.width, h = img.height; if (w > h && w > maxWidth) { h *= maxWidth / w; w = maxWidth; } else if (h > maxHeight) { w *= maxHeight / h; h = maxHeight; } canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', quality)); }; }; }); }
function solicitarGuardarPerfil() { Swal.fire({ title: 'Confirmar', text: "Ingresa tu contraseña:", input: 'password', showCancelButton: true }).then((r) => { if (r.isConfirmed && r.value) guardarPerfilReal(r.value); }); }
async function guardarPerfilReal(password) {
    try { await auth.signInWithEmailAndPassword(auth.currentUser.email, password); } catch(e) { Swal.fire('Error', 'Pass incorrecto.', 'error'); return; }
    const updateData = { nombre: document.getElementById('perfil-nombre').value.toUpperCase() }; 
    if(currentUserRole === 'doctor') { updateData.cedula = document.getElementById('perfil-cedula').value.toUpperCase(); updateData.especialidad = document.getElementById('perfil-especialidad').value.toUpperCase(); }
    const fotoInput = document.getElementById('perfil-foto'); if (fotoInput.files.length > 0) updateData.fotoUrl = await comprimirImagen(fotoInput.files[0], 200, 200, 0.6);
    await db.collection('usuarios').doc(auth.currentUser.uid).update(updateData);
    document.getElementById('header-nombre').innerText = updateData.nombre; if(currentUserRole === 'doctor') document.getElementById('header-rol').innerText = updateData.especialidad; if(updateData.fotoUrl) document.getElementById('header-avatar').src = updateData.fotoUrl;
    Swal.fire('¡Éxito!', 'Perfil actualizado.', 'success');
}

async function cambiarContrasena(e) { e.preventDefault(); const nuevaPass = document.getElementById('perfil-pass').value; try { await auth.currentUser.updatePassword(nuevaPass); Swal.fire('Seguridad', 'Tu contraseña ha sido cambiada.', 'success'); e.target.reset(); } catch(error) { if(error.code === 'auth/requires-recent-login') { Swal.fire('Atención', 'Debes cerrar sesión y volver a entrar antes de cambiar tu contraseña.', 'warning'); } else { Swal.fire('Error', error.message, 'error'); } } }

// ==========================================
// 4. ASISTENCIA Y STAFF
// ==========================================
async function crearPersonal(e) { e.preventDefault(); const rol = document.getElementById('staff-rol').value, nom = document.getElementById('staff-nombre').value.toUpperCase(); const email = document.getElementById('staff-email').value, pass = document.getElementById('staff-password').value; try { const n = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass); await db.collection('usuarios').doc(n.user.uid).set({ nombre: nom, email: email, rol: rol, estado: 'activo' }); await secondaryApp.auth().signOut(); Swal.fire('Éxito', 'Personal creado', 'success'); e.target.reset(); cargarStaff(); } catch(error) { let m = error.code === 'auth/email-already-in-use' ? "El correo ya existe" : error.code === 'auth/weak-password' ? "Mínimo 6 caracteres" : error.message; Swal.fire('Error', m, 'error'); } }
async function cargarStaff() { const lista = document.getElementById('lista-staff'); lista.innerHTML = 'Cargando personal...'; const snap = await db.collection('usuarios').get(); let html = ''; snap.forEach(doc => { const u = doc.data(); if(u.estado === 'eliminado' || doc.id === auth.currentUser.uid) return; const badge = u.estado === 'suspendido' ? 'badge-suspended' : 'badge-active'; const txtBadge = u.estado === 'suspendido' ? 'Suspendido' : 'Activo'; const btnAccion = u.estado === 'suspendido' ? `<button onclick="toggleEstadoStaff('${doc.id}', 'activo')" class="btn-secondary" style="padding:4px 8px; font-size:11px;">Reactivar</button>` : `<button onclick="toggleEstadoStaff('${doc.id}', 'suspendido')" class="btn-secondary" style="padding:4px 8px; font-size:11px;">Suspender (Vacaciones)</button>`; html += `<div style="border:1px solid var(--line); padding:10px; border-radius:8px; margin-bottom:10px;"><div style="display:flex; justify-content:space-between;"><b>${u.nombre} <small>(${u.rol})</small></b> <span class="badge ${badge}">${txtBadge}</span></div><div style="display:flex; justify-content:space-between; margin-top:10px;">${btnAccion}<button onclick="eliminarStaff('${doc.id}')" class="btn-secondary" style="border-color:var(--danger); color:var(--danger); padding:4px 8px; font-size:11px; width:auto;">Eliminar</button></div></div>`; }); lista.innerHTML = html || '<p class="muted">No hay personal extra registrado.</p>'; }
async function toggleEstadoStaff(id, nuevoEstado) { await db.collection('usuarios').doc(id).update({ estado: nuevoEstado }); cargarStaff(); }
async function eliminarStaff(id) { Swal.fire({ title: '¿Seguro?', text: "Los registros que haya hecho este enfermero se conservarán intactos.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Eliminar' }).then(async (result) => { if (result.isConfirmed) { await db.collection('usuarios').doc(id).update({ estado: 'eliminado' }); cargarStaff(); } }); }

// ==========================================
// 5. SALA DE ESPERA
// ==========================================
function cargarCitas() {
    const hoyStr = new Date().toISOString().split('T')[0];
    db.collection('citas').where('fecha', '>=', hoyStr).onSnapshot(snap => {
        const lista = document.getElementById('lista-citas'); lista.innerHTML = ''; let citasHoy = [];
        snap.forEach(doc => { if (doc.data().estado !== 'Completada') citasHoy.push({id: doc.id, ...doc.data()}); });
        citasHoy.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
        citasHoy.forEach(c => {
            const div = document.createElement('div'); div.className = 'card'; div.style.marginBottom = '15px'; div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center'; div.style.flexWrap = 'wrap';
            let botones = c.signosVitales ? `<span style="color:#10b981;font-weight:bold;">✅ Signos Listos</span>` : `<button onclick="abrirModalVitals('${c.id}')" class="btn-signos" style="margin-top: 5px;">🩺 Tomar Signos</button>`;
            
            if (currentUserRole === 'doctor') {
                if(c.signosVitales) { botones += `<button onclick="abrirModalConsulta('${c.id}')" class="btn-primary" style="width:auto;margin-left:10px;padding:6px 12px;font-size:12px;background:#0284c7;margin-top:5px;">Atender</button>`; } 
                else { botones += `<button disabled class="btn-disabled" style="width:auto;margin-left:10px;padding:6px 12px;font-size:12px;margin-top:5px;" title="La enfermera debe tomar los signos primero">Atender (Faltan Signos)</button>`; }
            }
            div.innerHTML = `<div style="flex: 1; min-width: 200px;"><strong>${c.nombre}</strong> <small>(${c.telefono})</small><br><span style="font-size:13px;">${c.motivo}</span><div style="margin-top:8px;">${botones}</div></div><div style="text-align:right; flex: 1; min-width: 100px; margin-top: 10px;"><b>${c.hora}</b><br><small>${c.fecha}</small></div>`;
            lista.appendChild(div);
        });
    });
}
function formatearFechaInvertida(f) { if(!f) return ''; const p = f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function calcularEdad(f) { if(!f) return 'N/D'; const h = new Date(); const c = new Date(f); let e = h.getFullYear() - c.getFullYear(); const m = h.getMonth() - c.getMonth(); if (m < 0 || (m === 0 && h.getDate() < c.getDate())) e--; return e; }
async function generarNumeroExpediente() { const snap = await db.collection('pacientes').get(); const total = snap.size + 1; const year = new Date().getFullYear(); return `EXP-${year}-${String(total).padStart(4, '0')}`; }

async function crearPacienteManual(e) {
    e.preventDefault();
    const nom = document.getElementById('man-nom').value.trim().toUpperCase(); 
    const ap1 = document.getElementById('man-ap1').value.trim().toUpperCase(); 
    const ap2 = document.getElementById('man-ap2').value.trim().toUpperCase();
    const tel = document.getElementById('man-tel').value.trim(); const nac = document.getElementById('man-nac').value; const sex = document.getElementById('man-sexo').value;
    const nombreCompleto = [nom, ap1, ap2].filter(Boolean).join(' '); const numExp = await generarNumeroExpediente();

    await db.collection('pacientes').add({
        nombre: nombreCompleto, nombrePila: nom, apellido1: ap1, apellido2: ap2,
        telefono: tel, nacimiento: nac, sexo: sex, numExpediente: numExp, creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('modal-nuevo-paciente').style.display = 'none'; e.target.reset(); Swal.fire('Excelente', `Paciente creado con expediente: ${numExp}`, 'success'); cargarDirectorioPacientes();
}

// ----------------------------------------------------
// LÓGICA DE SIGNOS VITALES CORREGIDA (BUSCADOR INCLUIDO)
// ----------------------------------------------------
async function abrirModalVitals(idCita) { const docCita = await db.collection('citas').doc(idCita).get(); document.getElementById('vitals-cita-id').value = idCita; document.getElementById('vitals-paciente-nombre').innerText = `Cita de: ${docCita.data().nombre}`; document.getElementById('modal-vitals').style.display = 'flex'; }
function cerrarModalVitals() { document.getElementById('modal-vitals').style.display = 'none'; }

async function guardarSignosVitales(e) {
    e.preventDefault();
    const idCita = document.getElementById('vitals-cita-id').value;
    const docCita = await db.collection('citas').doc(idCita).get(); const cita = docCita.data();

    const signos = { peso: document.getElementById('vit-peso').value, estatura: document.getElementById('vit-estatura').value, presion: document.getElementById('vit-presion').value, temperatura: document.getElementById('vit-temp').value, frecuenciaCardiaca: document.getElementById('vit-fc').value, registradoEn: firebase.firestore.FieldValue.serverTimestamp() };

    let pacienteIdFinal = cita.pacienteId || null; let nombreFinal = cita.nombre; 

    if (!pacienteIdFinal) {
        // Opciones por defecto
        let opciones = {
            'NUEVO': '🟢 + CREAR NUEVO EXPEDIENTE',
            'BUSCAR': '🔍 BUSCAR EXPEDIENTE EXISTENTE (MANUAL)'
        };
        
        // Sugerencias por teléfono
        const pacientesSnap = await db.collection('pacientes').where('telefono', '==', cita.telefono).get();
        pacientesSnap.forEach(d => { 
            const pData = d.data(); 
            opciones[d.id] = `⭐ SUGERENCIA: [${pData.numExpediente || 'S/N'}] ${pData.nombre}`; 
        });
        
        const { value: seleccion } = await Swal.fire({
            title: 'Asignar Expediente',
            text: '¿A qué expediente desea guardar estos signos vitales?',
            input: 'select',
            inputOptions: opciones,
            showCancelButton: true,
            confirmButtonText: 'Continuar'
        });

        if(!seleccion) return; // Se canceló

        if(seleccion === 'NUEVO') {
            const numExp = await generarNumeroExpediente();
            const newDoc = await db.collection('pacientes').add({ numExpediente: numExp, telefono: cita.telefono, nombre: cita.nombre, nombrePila: cita.nombrePila||'', apellido1: cita.apellido1||'', apellido2: cita.apellido2||'', nacimiento: cita.nacimiento||'', sexo: cita.sexo||'N/D', creadoEn: firebase.firestore.FieldValue.serverTimestamp() });
            pacienteIdFinal = newDoc.id;
            Swal.fire('Expediente Creado', `Se generó el EXP: ${numExp}`, 'info');
        } 
        else if (seleccion === 'BUSCAR') {
            const { value: term } = await Swal.fire({ title: 'Buscar Paciente', input: 'text', inputLabel: 'Escriba Nombre o Expediente:', inputPlaceholder: 'Ej. JUAN o EXP-2024', showCancelButton: true });
            if(!term) return;

            const snap = await db.collection('pacientes').get();
            let searchOpts = {};
            snap.forEach(d => {
                const p = d.data();
                if (p.numExpediente !== 'S/N' && ((p.nombre && p.nombre.includes(term.toUpperCase())) || (p.numExpediente && p.numExpediente.includes(term.toUpperCase())))) {
                    searchOpts[d.id] = `[${p.numExpediente}] ${p.nombre}`;
                }
            });

            if(Object.keys(searchOpts).length === 0) return Swal.fire('Sin resultados', 'No se encontró a nadie con ese nombre o dato.', 'error');

            const { value: selBusqueda } = await Swal.fire({ title: 'Seleccione el paciente correcto', input: 'select', inputOptions: searchOpts, showCancelButton: true });
            if(!selBusqueda) return;

            pacienteIdFinal = selBusqueda;
            const fDoc = await db.collection('pacientes').doc(selBusqueda).get();
            nombreFinal = fDoc.data().nombre;
        } 
        else {
            // Eligió una sugerencia
            pacienteIdFinal = seleccion; 
            const fDoc = await db.collection('pacientes').doc(seleccion).get(); 
            nombreFinal = fDoc.data().nombre; 
        }
    }

    await db.collection('citas').doc(idCita).update({ signosVitales: signos, pacienteId: pacienteIdFinal, nombre: nombreFinal });
    cerrarModalVitals(); e.target.reset(); mostrarNotificacion('Signos guardados correctamente');
}

// ==========================================
// 6. CONSULTA, NOTA MÉDICA PRIVADA Y PDF
// ==========================================
async function abrirModalConsulta(citaId) {
    const docCita = await db.collection('citas').doc(citaId).get(); const cita = docCita.data();
    let p = null; let edad = 'N/D';
    if (cita.pacienteId) { const docP = await db.collection('pacientes').doc(cita.pacienteId).get(); if(docP.exists) { p = docP.data(); edad = calcularEdad(p.nacimiento); } } 
    document.getElementById('cons-cita-id').value = citaId;
    if (p) {
        document.getElementById('cons-paciente-nombre').innerText = `Atendiendo a: ${p.nombre} (${edad} años)`;
        document.getElementById('cons-signos-vitales').innerHTML = `<div style="background:#f1f5f9; padding:10px; border-radius:8px; font-size:13px;"><b>Expediente:</b> <span style="color:var(--primary); font-weight:bold;">${p.numExpediente || 'S/N'}</span> | ${p.sexo} | Nacimiento: ${formatearFechaInvertida(p.nacimiento)}<br><hr style="margin:8px 0; border:0; border-top:1px solid #ddd;"><b>Signos:</b> Peso: ${cita.signosVitales?.peso||'--'}kg | P.A: ${cita.signosVitales?.presion||'--'} | Temp: ${cita.signosVitales?.temperatura||'--'}°C | FC: ${cita.signosVitales?.frecuenciaCardiaca||'--'}</div>`;
    } else {
        document.getElementById('cons-paciente-nombre').innerText = `Atendiendo a: ${cita.nombre}`;
        document.getElementById('cons-signos-vitales').innerHTML = "<span style='color:var(--danger);'>⚠️ Falta asignar expediente.</span>";
    }
    document.getElementById('modal-consulta').style.display = 'flex';
}
function cerrarModalConsulta() { document.getElementById('modal-consulta').style.display = 'none'; }

async function guardarConsulta(e) {
    e.preventDefault();
    const id = document.getElementById('cons-cita-id').value; 
    const diag = document.getElementById('cons-diagnostico').value; 
    const receta = document.getElementById('cons-receta').value;
    const notaSecreta = document.getElementById('cons-nota').value.trim(); 

    const docCita = await db.collection('citas').doc(id).get(); const cita = docCita.data();
    let expNum = 'S/N'; if(cita.pacienteId){ const docP = await db.collection('pacientes').doc(cita.pacienteId).get(); expNum = docP.data().numExpediente || 'S/N'; }

    if (notaSecreta && cita.pacienteId) {
        await db.collection('apuntes').add({ pacienteId: cita.pacienteId, texto: notaSecreta, fecha: firebase.firestore.FieldValue.serverTimestamp() });
    }

    await db.collection('citas').doc(id).update({ diagnostico: diag, receta: receta, estado: 'Completada' });
    generarPDF(cita.nombre, diag, receta, cita.fecha, expNum);
    cerrarModalConsulta(); e.target.reset(); Swal.fire('¡Listo!', 'Consulta finalizada. Nota y Receta guardadas.', 'success');
}

function generarPDF(n, d, r, f, expNum) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'l', unit: 'in', format: [5.5, 8.5] });
    const fImp = f ? formatearFechaInvertida(f) : new Date().toLocaleDateString();
    doc.setFontSize(16); doc.setTextColor(14, 165, 233); doc.text("RECETA MÉDICA", 0.5, 0.8);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.text(`Paciente: ${n}`, 0.5, 1.2); 
    doc.text(`Fecha: ${fImp}`, 6.0, 1.2); if(expNum) doc.text(`Expediente: ${expNum}`, 6.0, 1.4); 
    doc.line(0.5, 1.5, 8.0, 1.5);
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text("DIAGNÓSTICO:", 0.5, 1.9); doc.setFont(undefined, 'normal'); doc.setFontSize(10); doc.text(doc.splitTextToSize(d, 7.5), 0.5, 2.1);
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text("TRATAMIENTO:", 0.5, 2.9); doc.setFont(undefined, 'normal'); doc.setFontSize(10); doc.text(doc.splitTextToSize(r, 7.5), 0.5, 3.1);
    doc.line(5.5, 4.8, 7.5, 4.8); doc.text("Firma del Médico Tratante", 6.5, 5.0, {align: 'center'});
    doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

// ==========================================
// 7. DIRECTORIO Y UNIFICACIÓN
// ==========================================
async function cargarDirectorioPacientes() {
    const lista = document.getElementById('lista-busqueda'); lista.innerHTML = '<p>Cargando pacientes...</p>';
    const snapPacientes = await db.collection('pacientes').orderBy('nombre').get();
    let listaPacientes = snapPacientes.docs.map(d => ({ docId: d.id, id: d.id, ...d.data() }));
    
    const snapCitas = await db.collection('citas').get();
    let telefonosRegistrados = listaPacientes.map(p => p.telefono);
    
    snapCitas.forEach(doc => {
        const c = doc.data();
        if (!c.pacienteId && !telefonosRegistrados.includes(c.telefono) && c.nombre) {
            listaPacientes.push({ docId: null, id: c.telefono, nombre: c.nombre, telefono: c.telefono, nacimiento: c.nacimiento || '', sexo: c.sexo || 'N/D', numExpediente: 'S/N' });
            telefonosRegistrados.push(c.telefono);
        }
    });

    listaPacientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
    renderizarListaPacientes(listaPacientes);
}

async function buscarPaciente() {
    const b = document.getElementById('busqueda-paciente').value.toLowerCase(); 
    if (!b) { cargarDirectorioPacientes(); return; }
    
    const snapPacientes = await db.collection('pacientes').get();
    let lista = snapPacientes.docs.map(d => ({ docId: d.id, id: d.id, ...d.data() }));
    const snapCitas = await db.collection('citas').get();
    let telefonos = lista.map(p => p.telefono);
    
    snapCitas.forEach(doc => {
        const c = doc.data();
        if (!c.pacienteId && !telefonos.includes(c.telefono) && c.nombre) {
            lista.push({ docId: null, id: c.telefono, nombre: c.nombre, telefono: c.telefono, nacimiento: c.nacimiento || '', sexo: c.sexo || 'N/D', numExpediente: 'S/N' });
            telefonos.push(c.telefono);
        }
    });

    const filtrados = lista.filter(p => p.nombre.toLowerCase().includes(b) || p.telefono.includes(b) || (p.numExpediente && p.numExpediente.toLowerCase().includes(b)));
    renderizarListaPacientes(filtrados);
}

function renderizarListaPacientes(arr) {
    const lista = document.getElementById('lista-busqueda'); lista.innerHTML = '';
    if (arr.length === 0) lista.innerHTML = '<p style="color:var(--muted);">No hay pacientes.</p>';
    arr.forEach(p => {
        const div = document.createElement('div'); div.className = 'card'; div.style.marginBottom = '10px'; div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center'; div.style.flexWrap = 'wrap';
        
        let botones = `<button onclick="abrirHistorial('${p.id}', '${p.telefono}', '${p.nombre.replace(/'/g,"\\'")}', '${p.nacimiento}', '${p.sexo}', '${p.numExpediente}')" class="btn-secondary" style="width:auto;padding:5px 15px; margin-top: 10px;">Abrir Expediente</button>`;
        
        if (p.numExpediente === 'S/N' && currentUserRole === 'doctor') {
            botones = `<button onclick="unificarBusquedaInteligente('${p.telefono}', '${p.docId}')" class="btn-primary" style="background:#f97316; width:auto; padding:5px 15px; margin-top:10px; margin-right:10px;">🔗 Vincular a Expediente Oficial</button>` + botones;
        }

        div.innerHTML = `<div style="flex:1; min-width: 200px;"><strong>${p.nombre}</strong> <span style="color:var(--primary); font-size:12px; font-weight:bold;">[${p.numExpediente || 'S/N'}]</span><br><small>Tel: ${p.telefono} | Sexo: ${p.sexo}</small></div><div>${botones}</div>`;
        lista.appendChild(div);
    });
}

async function unificarBusquedaInteligente(telefonoOrigen, docIdRealSiExiste) {
    const { value: term } = await Swal.fire({ title: 'Buscar Expediente Oficial', input: 'text', inputLabel: 'Ingrese nombre o expediente a buscar:', inputPlaceholder: 'Ej. JUAN o EXP-2024', showCancelButton: true });
    if (!term) return;

    const snap = await db.collection('pacientes').get(); let opciones = {};
    snap.forEach(d => {
        const p = d.data();
        if (p.numExpediente !== 'S/N' && ((p.nombre && p.nombre.toLowerCase().includes(term.toLowerCase())) || (p.numExpediente && p.numExpediente.toLowerCase().includes(term.toLowerCase())))) {
            opciones[d.id] = `[${p.numExpediente}] ${p.nombre}`;
        }
    });

    if (Object.keys(opciones).length === 0) return Swal.fire('Sin resultados', 'No se encontró.', 'info');

    const { value: pacIdOficial } = await Swal.fire({ title: 'Seleccione el destino', input: 'select', inputOptions: opciones, showCancelButton: true });

    if (pacIdOficial) {
        const batch = db.batch(); let citasSnap;
        if(docIdRealSiExiste && docIdRealSiExiste !== 'null') citasSnap = await db.collection('citas').where('pacienteId', '==', docIdRealSiExiste).get();
        else citasSnap = await db.collection('citas').where('telefono', '==', telefonoOrigen).get();
        
        citasSnap.forEach(doc => { batch.update(doc.ref, { pacienteId: pacIdOficial }); });
        
        if(docIdRealSiExiste && docIdRealSiExiste !== 'null') { batch.delete(db.collection('pacientes').doc(docIdRealSiExiste)); }
        await batch.commit(); Swal.fire('Unificado', 'El historial se ha unido y el registro fantasma desapareció.', 'success'); cargarDirectorioPacientes();
    }
}

// ==========================================
// 8. FICHA CLÍNICA (3 Pestañas y Notas libres)
// ==========================================
let curHistPacienteId = null;

async function abrirHistorial(pacienteId, tel, nom, nac, sex, expNum) {
    curHistPacienteId = pacienteId;
    document.getElementById('hist-nombre').innerText = `Expediente: ${nom}`;
    document.getElementById('hist-datos').innerHTML = `<b>Núm:</b> ${expNum || 'S/N'} &nbsp;|&nbsp; <b>Edad:</b> ${calcularEdad(nac)} &nbsp;|&nbsp; <b>Sexo:</b> ${sex}`;
    cambiarTabHistorial('apuntes'); document.getElementById('modal-historial').style.display = 'flex';
}

function cambiarTabHistorial(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`btn-tab-${tabId}`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if(tabId === 'apuntes') cargarApuntesMedicos();
    if(tabId === 'signos' || tabId === 'recetas') cargarFichaClinica();
}

async function cargarApuntesMedicos() {
    const lista = document.getElementById('lista-apuntes-historial'); lista.innerHTML = 'Cargando notas médicas...';
    const snap = await db.collection('apuntes').where('pacienteId', '==', curHistPacienteId).get();
    
    if(snap.empty) { lista.innerHTML = '<p style="color:var(--muted);">No hay notas médicas.</p>'; return; }
    
    let arr = snap.docs.map(d => d.data()); arr.sort((a,b) => (b.fecha?.toDate() || new Date()) - (a.fecha?.toDate() || new Date()));
    
    let html = '';
    arr.forEach(data => {
        const dateStr = data.fecha ? data.fecha.toDate().toLocaleString('es-ES', {dateStyle: 'medium', timeStyle: 'short'}) : 'Reciente';
        html += `<div style="padding:15px; border-left:4px solid var(--primary); background:#f8fafc; margin-bottom:10px; border-radius:4px;"><small style="color:var(--primary-dark); font-weight:bold;">${dateStr}</small><br><div style="font-size:14px; margin-top:5px; white-space:pre-wrap;">${data.texto}</div></div>`;
    });
    lista.innerHTML = html;
}

async function guardarApunteMedico(e) {
    e.preventDefault(); const texto = document.getElementById('nuevo-apunte').value;
    await db.collection('apuntes').add({ pacienteId: curHistPacienteId, texto: texto, fecha: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('nuevo-apunte').value = ''; cargarApuntesMedicos(); 
}

async function cargarFichaClinica() {
    let snapCitas; const esTelefonoAntiguo = /^[0-9]+$/.test(curHistPacienteId); 
    if (esTelefonoAntiguo) { snapCitas = await db.collection('citas').where('telefono', '==', curHistPacienteId).where('estado', '==', 'Completada').get(); } 
    else { snapCitas = await db.collection('citas').where('pacienteId', '==', curHistPacienteId).where('estado', '==', 'Completada').get(); }
    
    let htmlSignos = ''; let htmlRecetas = '';
    if(!snapCitas.empty) {
        const citasArr = snapCitas.docs.map(d => d.data()).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
        citasArr.forEach(c => {
            const f = formatearFechaInvertida(c.fecha);
            if(c.signosVitales) { htmlSignos += `<div style="padding:10px; border-bottom:1px solid #eee; font-size:13px;"><b>${f}</b><br>Peso: ${c.signosVitales.peso}kg | Estatura: ${c.signosVitales.estatura}m | PA: ${c.signosVitales.presion} | Temp: ${c.signosVitales.temperatura}°C | FC: ${c.signosVitales.frecuenciaCardiaca}lpm</div>`; }
            if(c.diagnostico) { htmlRecetas += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><div style="font-size:13px;"><b>${f}</b><br><span style="color:var(--muted);">${c.diagnostico}</span></div><button onclick="generarPDF('${c.nombre.replace(/'/g,"\\'")}','${c.diagnostico.replace(/'/g,"\\'")}', '${c.receta.replace(/'/g,"\\'")}', '${c.fecha}', '')" class="btn-secondary" style="width:auto; padding:5px 10px; font-size:11px;">🖨️ Imprimir</button></div>`; }
        });
    }
    
    document.getElementById('lista-signos-historial').innerHTML = htmlSignos || '<p style="color:var(--muted);">No hay registro de signos vitales.</p>';
    document.getElementById('lista-recetas-historial').innerHTML = htmlRecetas || '<p style="color:var(--muted);">No hay recetas previas.</p>';
}

// ==========================================
// 9. AGENDA (CALENDARIO)
// ==========================================
let fechaNav = new Date(); let fechaSeleccionada = null; let citasDelMes = []; let bloqueosDelMes = [];
function cambiarMes(delta) { fechaNav.setMonth(fechaNav.getMonth() + delta); cargarDatosCalendario(); }
async function cargarDatosCalendario() { const year = fechaNav.getFullYear(), month = fechaNav.getMonth(); const p = `${year}-${String(month + 1).padStart(2, '0')}-01`, u = `${year}-${String(month + 1).padStart(2, '0')}-31`; const cSnap = await db.collection('citas').where('fecha', '>=', p).where('fecha', '<=', u).get(); citasDelMes = cSnap.docs.map(d => d.data()); const bSnap = await db.collection('bloqueos').where('fecha', '>=', p).where('fecha', '<=', u).get(); bloqueosDelMes = bSnap.docs.map(d => d.data()); dibujarCalendario(); }
function dibujarCalendario() { const year = fechaNav.getFullYear(), month = fechaNav.getMonth(); document.getElementById('mes-actual').innerText = fechaNav.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); const grid = document.getElementById('calendario-body'); grid.innerHTML = ''; const p = new Date(year, month, 1).getDay(), d = new Date(year, month + 1, 0).getDate(); for (let i = 0; i < p; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'dia-celda vacio'})); for (let i = 1; i <= d; i++) { const s = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`, div = document.createElement('div'); div.className = 'dia-celda'; div.innerText = i; if (s === new Date().toISOString().split('T')[0]) div.classList.add('hoy'); if (s === fechaSeleccionada) div.classList.add('seleccionado'); if (citasDelMes.some(c => c.fecha === s)) div.appendChild(Object.assign(document.createElement('div'), {className: 'dot-cita'})); if (bloqueosDelMes.some(b => b.fecha === s && b.horas.length >= 10)) div.classList.add('bloqueado'); div.onclick = () => seleccionarDiaCalendario(s, i, citasDelMes.filter(c => c.fecha === s), bloqueosDelMes.find(b => b.fecha === s)); grid.appendChild(div); } }
function seleccionarDiaCalendario(s, i, c, b) { fechaSeleccionada = s; dibujarCalendario(); document.getElementById('dia-detalle-titulo').innerText = new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); const p = document.getElementById('panel-citas-dia'); p.innerHTML = c.length ? c.map(x => `<div style="font-size:13px;border-bottom:1px solid #eee;padding:5px;"><b>${x.hora}</b> - ${x.nombre}</div>`).join('') : 'Sin citas'; if (currentUserRole === 'doctor') { document.getElementById('panel-bloqueos').style.display = 'block'; dibujarHorasBloqueo(b ? b.horas : []); } }
const TODAS_LAS_HORAS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"];
function dibujarHorasBloqueo(b) { const c = document.getElementById('lista-horas-bloqueo'); c.innerHTML = TODAS_LAS_HORAS.map(h => `<button class="hora-btn ${b?.includes(h) ? 'bloqueada' : ''}" onclick="this.classList.toggle('bloqueada')">${h}</button>`).join(''); }
async function guardarBloqueosDia() { const h = Array.from(document.querySelectorAll('.hora-btn.bloqueada')).map(x => x.innerText); try { if (!h.length) await db.collection('bloqueos').doc(fechaSeleccionada).delete(); else await db.collection('bloqueos').doc(fechaSeleccionada).set({ fecha: fechaSeleccionada, horas: h }); Swal.fire('Ok', 'Agenda actualizada', 'success'); cargarDatosCalendario(); } catch(e) {} }