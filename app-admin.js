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
let currentUserData = {};

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
    if(moduloId === 'perfil') cargarDatosFormularioPerfil();
    if(moduloId === 'asistencia') cargarStaff();

    if (window.innerWidth <= 768) { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); }
}

// ==========================================
// 3. AUTENTICACIÓN Y PERFIL
// ==========================================
async function loginUsuario(e) { e.preventDefault(); try { await auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value); } catch (e) { Swal.fire('Error', 'Credenciales incorrectas.', 'error'); } }

function logoutUsuario() { auth.signOut().then(() => { location.reload(); }); }

function cargarDatosFormularioPerfil() {
    if(!currentUserData) return;
    document.getElementById('perfil-nombre').value = currentUserData.nombre || '';
    if(currentUserRole === 'doctor') {
        document.getElementById('perfil-ced-fed').value = currentUserData.cedFed || '';
        document.getElementById('perfil-ced-est').value = currentUserData.cedEst || '';
        document.getElementById('perfil-especialidad').value = currentUserData.especialidad || '';
        document.getElementById('receta-domicilio').value = currentUserData.domicilio || '';
        document.getElementById('receta-borde').value = currentUserData.bordeReceta || 'CUADRADO';
        
        document.getElementById('receta-pie-izq1').value = currentUserData.pieIzq1 || '';
        document.getElementById('receta-pie-izq2').value = currentUserData.pieIzq2 || '';
        document.getElementById('receta-pie-der1').value = currentUserData.pieDer1 || '';
        document.getElementById('receta-pie-der2').value = currentUserData.pieDer2 || '';
    }
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const docUser = await db.collection('usuarios').doc(user.uid).get();
        if(docUser.exists) {
            currentUserData = docUser.data();
            if(currentUserData.estado === 'suspendido' || currentUserData.estado === 'eliminado') { await auth.signOut(); Swal.fire('Acceso Denegado', 'Su cuenta está inactiva.', 'error'); return; }
            currentUserRole = currentUserData.rol;
        } else {
            currentUserRole = 'doctor';
            currentUserData = { rol: 'doctor', email: user.email, nombre: 'DR. PRINCIPAL', estado: 'activo' };
            await db.collection('usuarios').doc(user.uid).set(currentUserData);
        }

        document.getElementById('header-nombre').innerText = currentUserData.nombre || user.email;
        document.getElementById('header-rol').innerText = currentUserRole === 'doctor' ? (currentUserData.especialidad || 'Médico Especialista') : 'Enfermería';
        if(currentUserData.fotoUrl) document.getElementById('header-avatar').src = currentUserData.fotoUrl;
        
        if(currentUserRole === 'doctor') {
            document.getElementById('btn-agenda').style.display = 'block'; document.getElementById('btn-pacientes').style.display = 'block'; document.getElementById('btn-asistencia').style.display = 'block'; document.getElementById('campos-doctor').style.display = 'block';
        } else {
            document.querySelectorAll('#btn-agenda, #btn-pacientes, #btn-asistencia, #campos-doctor').forEach(el => el.style.display = 'none'); navegarMódulo('espera'); 
        }
        document.getElementById('view-login').style.display = 'none'; document.getElementById('view-dashboard').style.display = 'flex'; cargarCitas();
    } else {
        document.getElementById('view-login').style.display = 'flex'; document.getElementById('view-dashboard').style.display = 'none';
    }
});

function comprimirImagen(file, maxWidth, maxHeight, quality) { 
    return new Promise((resolve) => { 
        const reader = new FileReader(); reader.readAsDataURL(file); 
        reader.onload = (e) => { 
            const img = new Image(); img.src = e.target.result; 
            img.onload = () => { 
                const canvas = document.createElement('canvas'); let w = img.width, h = img.height; 
                if (w > maxWidth || h > maxHeight) { 
                    const ratio = Math.min(maxWidth / w, maxHeight / h); w = w * ratio; h = h * ratio;
                } 
                canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h); 
                const tipoSalida = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                resolve(canvas.toDataURL(tipoSalida, quality)); 
            }; 
        }; 
    }); 
}

function solicitarGuardarDatosMedicos() { 
    Swal.fire({ 
        title: 'Confirmar Identidad', 
        text: "Ingresa tu contraseña para modificar tus datos personales:", 
        input: 'password', 
        showCancelButton: true 
    }).then((r) => { 
        if (r.isConfirmed && r.value) guardarDatosMedicosReal(r.value); 
    }); 
}

async function guardarDatosMedicosReal(password) {
    try { await auth.signInWithEmailAndPassword(auth.currentUser.email, password); } catch(e) { Swal.fire('Error', 'Contraseña incorrecta.', 'error'); return; }
    
    Swal.fire({ title: 'Guardando datos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const updateData = { nombre: document.getElementById('perfil-nombre').value.toUpperCase() }; 
    if(currentUserRole === 'doctor') { 
        updateData.cedFed = document.getElementById('perfil-ced-fed').value.toUpperCase(); 
        updateData.cedEst = document.getElementById('perfil-ced-est').value.toUpperCase(); 
        updateData.especialidad = document.getElementById('perfil-especialidad').value.toUpperCase(); 
    }
    
    const fotoInput = document.getElementById('perfil-foto'); 
    if (fotoInput.files.length > 0) updateData.fotoUrl = await comprimirImagen(fotoInput.files[0], 200, 200, 0.6);
    
    await db.collection('usuarios').doc(auth.currentUser.uid).update(updateData);
    currentUserData = {...currentUserData, ...updateData};

    document.getElementById('header-nombre').innerText = updateData.nombre; 
    if(currentUserRole === 'doctor') document.getElementById('header-rol').innerText = updateData.especialidad; 
    if(updateData.fotoUrl) document.getElementById('header-avatar').src = updateData.fotoUrl;
    
    Swal.fire('¡Seguridad Ok!', 'Datos personales actualizados correctamente.', 'success');
}

async function guardarDisenoReceta() {
    const confirm = await Swal.fire({
        title: '¿Guardar Diseño?',
        text: '¿Deseas aplicar estos cambios a tus futuras recetas?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, aplicar diseño'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'Procesando imágenes y textos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const updateData = { bordeReceta: document.getElementById('receta-borde').value }; 
    
    if(currentUserRole === 'doctor') { 
        updateData.domicilio = document.getElementById('receta-domicilio').value.toUpperCase();
        updateData.pieIzq1 = document.getElementById('receta-pie-izq1').value.toUpperCase();
        updateData.pieIzq2 = document.getElementById('receta-pie-izq2').value.toUpperCase();
        updateData.pieDer1 = document.getElementById('receta-pie-der1').value.toUpperCase();
        updateData.pieDer2 = document.getElementById('receta-pie-der2').value.toUpperCase();
    }
    
    const logoInput = document.getElementById('receta-logo'); 
    if (logoInput.files.length > 0) updateData.logoBase64 = await comprimirImagen(logoInput.files[0], 400, 400, 0.8);
    
    const watInput = document.getElementById('receta-watermark'); 
    if (watInput.files.length > 0) updateData.watermarkBase64 = await comprimirImagen(watInput.files[0], 600, 600, 0.6);

    await db.collection('usuarios').doc(auth.currentUser.uid).update(updateData);
    currentUserData = {...currentUserData, ...updateData};

    Swal.fire('¡Éxito!', 'Diseño de la receta y membretes actualizados.', 'success');
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
// 5. SALA DE ESPERA INTELIGENTE Y CITAS EXPRESS
// ==========================================
function cargarCitas() {
    const hoyStr = new Date().toISOString().split('T')[0];
    if(document.getElementById('fecha-hoy')) document.getElementById('fecha-hoy').innerText = new Date().toLocaleDateString('es-ES', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});

    db.collection('citas').where('fecha', '==', hoyStr).onSnapshot(snap => {
        const lista = document.getElementById('lista-citas'); lista.innerHTML = ''; let citasHoy = [];
        const ahoraStr = new Date().toLocaleTimeString('es-ES', {hour12:false, hour:'2-digit', minute:'2-digit'});
        
        snap.forEach(doc => { 
            const c = doc.data(); if (c.estado === 'Completada') return; 
            if (!c.signosVitales && c.hora < ahoraStr) return; citasHoy.push({id: doc.id, ...c}); 
        });
        citasHoy.sort((a, b) => a.hora.localeCompare(b.hora));
        
        citasHoy.forEach(c => {
            const div = document.createElement('div'); div.className = 'card'; div.style.marginBottom = '15px'; div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center'; div.style.flexWrap = 'wrap';
            let botones = c.signosVitales ? `<button onclick="abrirModalVitals('${c.id}')" class="btn-secondary" style="margin-top: 5px; color:#10b981; border-color:#10b981;">✅ Corregir Signos</button>` : `<button onclick="abrirModalVitals('${c.id}')" class="btn-signos" style="margin-top: 5px;">🩺 Tomar Signos</button>`;
            if (currentUserRole === 'doctor') {
                if(c.signosVitales) { botones += `<button onclick="abrirModalConsulta('${c.id}')" class="btn-primary" style="width:auto;margin-left:10px;padding:6px 12px;font-size:12px;background:#0284c7;margin-top:5px;">Atender</button>`; } 
                else { botones += `<button disabled class="btn-disabled" style="width:auto;margin-left:10px;padding:6px 12px;font-size:12px;margin-top:5px;">Atender (Faltan Signos)</button>`; }
            }
            div.innerHTML = `<div style="flex: 1; min-width: 200px;"><strong>${c.nombre}</strong> <small>(${c.telefono || 'S/N'})</small><br><span style="font-size:13px;">${c.motivo}</span><div style="margin-top:8px;">${botones}</div></div><div style="text-align:right; flex: 1; min-width: 100px; margin-top: 10px;"><b>${c.hora}</b><br><small>${c.fecha}</small></div>`;
            lista.appendChild(div);
        });
        if (citasHoy.length === 0) lista.innerHTML = '<p style="color:var(--muted); text-align:center;">No hay pacientes en espera.</p>';
    });
}

async function consultaSinCita() {
    const { value: formValues } = await Swal.fire({
        title: 'Consulta Express',
        html: `<input id="swal-nom" class="swal2-input" placeholder="Nombre Completo" style="text-transform:uppercase;">
               <input id="swal-mot" class="swal2-input" placeholder="Motivo de la urgencia" style="text-transform:uppercase;">
               <input id="swal-tel" class="swal2-input" placeholder="Teléfono" type="tel">`,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'Añadir a Espera',
        preConfirm: () => [document.getElementById('swal-nom').value.trim().toUpperCase(), document.getElementById('swal-mot').value.trim().toUpperCase(), document.getElementById('swal-tel').value.trim()]
    });
    if (formValues && formValues[0]) {
        const hoy = new Date().toISOString().split('T')[0];
        const ahora = new Date().toLocaleTimeString('es-ES', {hour12:false, hour:'2-digit', minute:'2-digit'});
        await db.collection('citas').add({ nombre: formValues[0], motivo: formValues[1], telefono: formValues[2] || 'S/N', fecha: hoy, hora: ahora, estado: 'Pendiente', creadoEn: firebase.firestore.FieldValue.serverTimestamp() });
        Swal.fire('Agregado', 'Paciente añadido a la sala de espera.', 'success');
    }
}

function formatearFechaInvertida(f) { if(!f) return ''; const p = f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function calcularEdad(f) { if(!f) return 'N/D'; const h = new Date(); const c = new Date(f); let e = h.getFullYear() - c.getFullYear(); const m = h.getMonth() - c.getMonth(); if (m < 0 || (m === 0 && h.getDate() < c.getDate())) e--; return e; }
async function generarNumeroExpediente() { const snap = await db.collection('pacientes').get(); return `EXP-${new Date().getFullYear()}-${String(snap.size + 1).padStart(4, '0')}`; }

async function crearPacienteManual(e) {
    e.preventDefault();
    const nom = document.getElementById('man-nom').value.trim().toUpperCase(); const ap1 = document.getElementById('man-ap1').value.trim().toUpperCase(); const ap2 = document.getElementById('man-ap2').value.trim().toUpperCase();
    const tel = document.getElementById('man-tel').value.trim(); const nac = document.getElementById('man-nac').value; const sex = document.getElementById('man-sexo').value;
    const nombreCompleto = [nom, ap1, ap2].filter(Boolean).join(' '); const numExp = await generarNumeroExpediente();
    await db.collection('pacientes').add({ nombre: nombreCompleto, nombrePila: nom, apellido1: ap1, apellido2: ap2, telefono: tel, nacimiento: nac, sexo: sex, numExpediente: numExp, creadoEn: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('modal-nuevo-paciente').style.display = 'none'; e.target.reset(); Swal.fire('Excelente', `Paciente creado con expediente: ${numExp}`, 'success'); cargarDirectorioPacientes();
}

// ==========================================
// TOMA DE SIGNOS Y BUSCADOR PREDICTIVO
// ==========================================
async function abrirModalVitals(idCita) { 
    const docCita = await db.collection('citas').doc(idCita).get(); const cita = docCita.data();
    document.getElementById('vitals-cita-id').value = idCita; document.getElementById('vitals-paciente-nombre').innerText = `Cita de: ${cita.nombre}`; 
    if(cita.signosVitales) {
        document.getElementById('vit-peso').value = cita.signosVitales.peso || ''; document.getElementById('vit-estatura').value = cita.signosVitales.estatura || ''; document.getElementById('vit-presion').value = cita.signosVitales.presion || ''; document.getElementById('vit-temp').value = cita.signosVitales.temperatura || ''; document.getElementById('vit-fc').value = cita.signosVitales.frecuenciaCardiaca || '';
    } else {
        document.getElementById('vit-peso').value = ''; document.getElementById('vit-estatura').value = ''; document.getElementById('vit-presion').value = ''; document.getElementById('vit-temp').value = ''; document.getElementById('vit-fc').value = '';
    }
    document.getElementById('modal-vitals').style.display = 'flex'; 
}
function cerrarModalVitals() { document.getElementById('modal-vitals').style.display = 'none'; }

async function lanzarBuscadorPredictivoDirecto() {
    return new Promise(async (resolve) => {
        const pacientesSnap = await db.collection('pacientes').get();
        let todosLosPacientes = [];
        pacientesSnap.forEach(d => { todosLosPacientes.push({ id: d.id, ...d.data() }); });

        Swal.fire({
            title: '🔍 Buscar Expediente Oficial',
            html: `
                <input id="predictive-search-input" class="swal2-input" placeholder="Escriba nombre o expediente..." style="width:85%; margin-bottom:10px; text-transform:uppercase;">
                <div id="predictive-results-box" style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:6px; text-align:left; background:#fff;">
                    <p style="padding:10px; color:#94a3b8; font-size:13px; text-align:center;">Escriba para empezar la búsqueda...</p>
                </div>
            `,
            showCancelButton: true,
            showConfirmButton: false,
            cancelButtonText: 'Cerrar',
            didOpen: () => {
                const input = document.getElementById('predictive-search-input');
                const box = document.getElementById('predictive-results-box');

                input.addEventListener('input', () => {
                    const query = input.value.toUpperCase().trim();
                    if(!query) { box.innerHTML = '<p style="padding:10px; color:#94a3b8; font-size:13px; text-align:center;">Escriba para empezar la búsqueda...</p>'; return; }
                    
                    const filtered = todosLosPacientes.filter(p => p.nombre.includes(query) || (p.numExpediente && p.numExpediente.includes(query)));
                    
                    if(filtered.length === 0) { box.innerHTML = '<p style="padding:10px; color:#ef4444; font-size:13px; text-align:center;">No se encontraron coincidencias.</p>'; return; }

                    box.innerHTML = filtered.map(p => `
                        <div class="predictive-item-row" data-id="${p.id}" data-nombre="${p.nombre}" style="padding:10px; border-bottom:1px solid #f1f5f9; cursor:pointer; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='#fff'">
                            <strong>[${p.numExpediente || 'S/N'}]</strong> ${p.nombre} <span style="font-size:11px; color:#64748b;">(Tel: ${p.telefono})</span>
                        </div>
                    `).join('');

                    box.querySelectorAll('.predictive-item-row').forEach(row => {
                        row.addEventListener('click', () => {
                            const selectedId = row.getAttribute('data-id');
                            const selectedName = row.getAttribute('data-nombre');
                            Swal.close();
                            resolve({ id: selectedId, nombre: selectedName });
                        });
                    });
                });
            }
        }).then((result) => { if (result.isDismissed) resolve(null); });
    });
}

async function guardarSignosVitales(e) {
    e.preventDefault();
    const idCita = document.getElementById('vitals-cita-id').value;
    const docCita = await db.collection('citas').doc(idCita).get(); const cita = docCita.data();
    const signos = { peso: document.getElementById('vit-peso').value, estatura: document.getElementById('vit-estatura').value, presion: document.getElementById('vit-presion').value, temperatura: document.getElementById('vit-temp').value, frecuenciaCardiaca: document.getElementById('vit-fc').value, registradoEn: firebase.firestore.FieldValue.serverTimestamp() };

    let pacienteIdFinal = cita.pacienteId || null; let nombreFinal = cita.nombre; 

    if (!pacienteIdFinal) {
        const result = await Swal.fire({
            title: 'Falta Expediente',
            text: 'Este paciente no tiene expediente clínico vinculado.',
            icon: 'warning',
            showDenyButton: true, showCancelButton: true,
            confirmButtonText: '➕ Crear Nuevo', denyButtonText: '🔍 Buscar y Asignar', cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            const { value: datos } = await Swal.fire({
                title: 'Completar Datos',
                html: `<label style="display:block; margin-top:10px; text-align:left; font-size:13px; color:#64748b;">Fecha de Nacimiento</label>
                       <input type="date" id="swal-nac" class="swal2-input" style="width: 85%;">
                       <label style="display:block; margin-top:10px; text-align:left; font-size:13px; color:#64748b;">Sexo</label>
                       <select id="swal-sexo" class="swal2-select" style="width: 85%; background:#fff;">
                            <option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option>
                       </select>`,
                focusConfirm: false, preConfirm: () => [document.getElementById('swal-nac').value, document.getElementById('swal-sexo').value]
            });
            if (!datos || !datos[0]) { Swal.fire('Error', 'Captura incompleta.', 'error'); return; }
            const numExp = await generarNumeroExpediente();
            const newDoc = await db.collection('pacientes').add({ numExpediente: numExp, telefono: cita.telefono, nombre: cita.nombre, nacimiento: datos[0], sexo: datos[1], creadoEn: firebase.firestore.FieldValue.serverTimestamp() });
            pacienteIdFinal = newDoc.id;
        } else if (result.isDenied) {
            const resPredictivo = await lanzarBuscadorPredictivoDirecto();
            if(!resPredictivo) return;
            pacienteIdFinal = resPredictivo.id; nombreFinal = resPredictivo.nombre;
        } else { return; }
    }

    await db.collection('citas').doc(idCita).update({ signosVitales: signos, pacienteId: pacienteIdFinal, nombre: nombreFinal });
    cerrarModalVitals(); e.target.reset(); mostrarNotificacion('Signos guardados correctamente');
}

// ==========================================
// 6. CONSULTA, TABLA DE ENTRADA DOBLE Y PDF
// ==========================================
function agregarRenglonMedicamento(med = '', inst = '') {
    const tbody = document.getElementById('tbody-medicamentos');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="med-name-input" value="${med}" placeholder="Ej. PARACETAMOL 500MG TAB" required style="text-transform:uppercase;"></td>
        <td><input type="text" class="med-inst-input" value="${inst}" placeholder="Ej. TOMAR 1 TABLETA CADA 8 HORAS POR 5 DÍAS" required style="text-transform:uppercase;"></td>
        <td style="text-align:center;"><button type="button" class="btn-remove-row" onclick="this.closest('tr').remove()">❌</button></td>
    `;
    tbody.appendChild(tr);
}

async function abrirModalConsulta(citaId) {
    const docCita = await db.collection('citas').doc(citaId).get(); const cita = docCita.data();
    let p = null; let edad = 'N/D'; if (cita.pacienteId) { const docP = await db.collection('pacientes').doc(cita.pacienteId).get(); if(docP.exists) { p = docP.data(); edad = calcularEdad(p.nacimiento); } } 
    document.getElementById('cons-cita-id').value = citaId;
    
    if (p) {
        document.getElementById('cons-paciente-nombre').innerText = `Atendiendo a: ${p.nombre} (${edad} años)`;
        document.getElementById('cons-info-paciente').innerHTML = `<b>Expediente:</b> <span style="color:var(--primary); font-weight:bold;">${p.numExpediente || 'S/N'}</span> | ${p.sexo} | Nacimiento: ${formatearFechaInvertida(p.nacimiento)}<br><hr style="margin:8px 0; border:0; border-top:1px solid #ddd;"><b>Signos:</b> Peso: ${cita.signosVitales?.peso||'--'}kg | P.A: ${cita.signosVitales?.presion||'--'} | Temp: ${cita.signosVitales?.temperatura||'--'}°C | FC: ${cita.signosVitales?.frecuenciaCardiaca||'--'}`;
    } else {
        document.getElementById('cons-paciente-nombre').innerText = `Atendiendo a: ${cita.nombre}`;
        document.getElementById('cons-info-paciente').innerHTML = "<span style='color:var(--danger);'>⚠️ Falta asignar expediente.</span>";
    }

    document.getElementById('tbody-medicamentos').innerHTML = '';
    agregarRenglonMedicamento();

    document.getElementById('modal-consulta').style.display = 'flex';
}
function cerrarModalConsulta() { document.getElementById('modal-consulta').style.display = 'none'; }

async function guardarConsulta(e) {
    e.preventDefault();
    const id = document.getElementById('cons-cita-id').value; 
    const diag = document.getElementById('cons-diagnostico').value.toUpperCase(); 
    const notaSecreta = document.getElementById('cons-nota').value.trim(); 

    let medicamentosPrescritos = [];
    const filas = document.querySelectorAll('#tbody-medicamentos tr');
    filas.forEach(row => {
        const m = row.querySelector('.med-name-input').value.trim().toUpperCase();
        const i = row.querySelector('.med-inst-input').value.trim().toUpperCase();
        if(m) { medicamentosPrescritos.push(`${m}\n   -> ${i}`); }
    });

    const recetaTextoFinal = medicamentosPrescritos.join('\n\n');

    const docCita = await db.collection('citas').doc(id).get(); const cita = docCita.data();
    
    // PREVENCIÓN DE ERROR: Verificamos si el paciente existe antes de leer sus datos
    let expNum = 'S/N'; 
    if(cita.pacienteId){ 
        const docP = await db.collection('pacientes').doc(cita.pacienteId).get(); 
        if(docP.exists) { expNum = docP.data().numExpediente || 'S/N'; }
    }

    if (notaSecreta && cita.pacienteId) {
        await db.collection('apuntes').add({ pacienteId: cita.pacienteId, texto: notaSecreta, fecha: firebase.firestore.FieldValue.serverTimestamp() });
    }

    await db.collection('citas').doc(id).update({ diagnostico: diag, receta: recetaTextoFinal, estado: 'Completada' });
    generarPDF(cita.nombre, diag, recetaTextoFinal, cita.fecha, expNum);
    cerrarModalConsulta(); e.target.reset(); Swal.fire('¡Listo!', 'Consulta guardada y Receta emitida.', 'success');
}

function dibujarMarcoReceta(doc, estilo) {
    if(!estilo || estilo === 'NINGUNO') return;
    doc.saveGraphicsState(); doc.setDrawColor(14, 165, 233); 
    if(estilo === 'CUADRADO') { doc.setLineWidth(0.02); doc.rect(0.2, 0.2, 8.1, 5.1); } 
    else if(estilo === 'REDONDEADO') { doc.setLineWidth(0.02); doc.roundedRect(0.2, 0.2, 8.1, 5.1, 0.2, 0.2); } 
    else if(estilo === 'GARIGOLES') {
        doc.setLineWidth(0.03); doc.rect(0.2, 0.2, 8.1, 5.1);
        doc.setLineWidth(0.01); doc.rect(0.25, 0.25, 8.0, 5.0);
        doc.setFont("times", "italic"); doc.setFontSize(14);
        doc.text("«", 0.35, 0.45); doc.text("»", 8.15, 0.45);
        doc.text("«", 8.15, 5.2); doc.text("»", 0.35, 5.2);
    }
    doc.restoreGraphicsState();
}

function generarPDF(n, d, r, f, expNum) {
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [8.5, 5.5] });
    const config = currentUserData;

    dibujarMarcoReceta(doc, config.bordeReceta || 'CUADRADO');

    if(config.watermarkBase64) {
        doc.saveGraphicsState(); doc.setGState(new doc.GState({opacity: 0.1}));
        try {
            const pWat = doc.getImageProperties(config.watermarkBase64);
            let ww = 3.5; let wh = (pWat.height * ww) / pWat.width;
            if(wh > 3.5) { wh = 3.5; ww = (pWat.width * wh) / pWat.height; }
            doc.addImage(config.watermarkBase64, 'PNG', 4.25 - (ww/2), 2.75 - (wh/2), ww, wh); 
        } catch(e) { doc.addImage(config.watermarkBase64, 'PNG', 2.5, 1.0, 3.5, 3.5); }
        doc.restoreGraphicsState();
    }
    
    if(config.logoBase64) { 
        try {
            const pLog = doc.getImageProperties(config.logoBase64);
            let lw = 1.0; let lh = (pLog.height * lw) / pLog.width;
            if (lh > 1.0) { lh = 1.0; lw = (pLog.width * lh) / pLog.height; }
            doc.addImage(config.logoBase64, 'PNG', 0.4, 0.3, lw, lh); 
        } catch(e) { doc.addImage(config.logoBase64, 'PNG', 0.4, 0.3, 1.0, 1.0); }
    }

    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(config.nombre || "DR. NOMBRE", 4.25, 0.6, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(config.especialidad || "ESPECIALIDAD", 4.25, 0.85, { align: "center" });
    doc.setFontSize(9); const textCed = `Céd. Fed: ${config.cedFed || '---'}  |  Céd. Est: ${config.cedEst || '---'}`; doc.text(textCed, 4.25, 1.05, { align: "center" });
    doc.setLineWidth(0.01); doc.line(0.4, 1.4, 8.1, 1.4); 

    const fImp = f ? formatearFechaInvertida(f) : new Date().toLocaleDateString();
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`PACIENTE: ${n}`, 0.4, 1.7); doc.text(`FECHA: ${fImp}`, 6.5, 1.7);
    if(expNum) doc.text(`EXP: ${expNum}`, 6.5, 1.9);

    doc.text("DIAGNÓSTICO:", 0.4, 2.2); doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(d, 7.5), 0.4, 2.4);
    doc.setFont("helvetica", "bold"); doc.text("TRATAMIENTO / PRESCRIPCIÓN:", 0.4, 3.1); doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(r, 7.5), 0.4, 3.3);

    doc.setLineWidth(0.01); doc.line(0.4, 4.6, 8.1, 4.6); 
    doc.setFont("helvetica", "bold"); doc.text("Firma del Médico", 6.5, 4.5, {align: 'center'});
    
    doc.setFontSize(8); doc.setTextColor(100);
    doc.text(config.pieIzq1 || "", 0.4, 4.8); doc.text(config.pieIzq2 || "", 0.4, 5.0);
    doc.text(config.pieDer1 || "", 8.1, 4.8, { align: "right" }); doc.text(config.pieDer2 || "", 8.1, 5.0, { align: "right" });
    
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(config.domicilio || "", 3.0), 4.25, 4.8, { align: "center" });

    doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

// ==========================================
// 7. DIRECTORIO Y UNIFICACIÓN
// ==========================================
async function cargarDirectorioPacientes() {
    const lista = document.getElementById('lista-busqueda'); lista.innerHTML = '<p>Cargando pacientes...</p>';
    const snapPacientes = await db.collection('pacientes').orderBy('nombre').get();
    let listaPacientes = snapPacientes.docs.map(d => ({ docId: d.id, id: d.id, ...d.data() }));
    const snapCitas = await db.collection('citas').get(); let telefonosRegistrados = listaPacientes.map(p => p.telefono);
    
    snapCitas.forEach(doc => {
        const c = doc.data();
        if (!c.pacienteId && !telefonosRegistrados.includes(c.telefono) && c.nombre) {
            listaPacientes.push({ docId: null, id: c.telefono, nombre: c.nombre, telefono: c.telefono, nacimiento: c.nacimiento || '', sexo: c.sexo || 'N/D', numExpediente: 'S/N' });
            telefonosRegistrados.push(c.telefono);
        }
    });
    listaPacientes.sort((a, b) => a.nombre.localeCompare(b.nombre)); renderizarListaPacientes(listaPacientes);
}

async function buscarPaciente() {
    const b = document.getElementById('busqueda-paciente').value.toUpperCase(); if (!b) { cargarDirectorioPacientes(); return; }
    const snapPacientes = await db.collection('pacientes').get(); let lista = snapPacientes.docs.map(d => ({ docId: d.id, id: d.id, ...d.data() }));
    const snapCitas = await db.collection('citas').get(); let telefonos = lista.map(p => p.telefono);
    
    snapCitas.forEach(doc => {
        const c = doc.data();
        if (!c.pacienteId && !telefonos.includes(c.telefono) && c.nombre) {
            lista.push({ docId: null, id: c.telefono, nombre: c.nombre, telefono: c.telefono, nacimiento: c.nacimiento || '', sexo: c.sexo || 'N/D', numExpediente: 'S/N' }); telefonos.push(c.telefono);
        }
    });
    renderizarListaPacientes(lista.filter(p => p.nombre.includes(b) || p.telefono.includes(b) || (p.numExpediente && p.numExpediente.includes(b))));
}

function renderizarListaPacientes(arr) {
    const lista = document.getElementById('lista-busqueda'); lista.innerHTML = ''; if (arr.length === 0) lista.innerHTML = '<p style="color:var(--muted);">No hay pacientes.</p>';
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
    const elegido = await lanzarBuscadorPredictivoDirecto();
    if (!elegido) return;

    if (elegido.id) {
        const batch = db.batch();
        if(docIdRealSiExiste && docIdRealSiExiste !== 'null') {
            const cs = await db.collection('citas').where('pacienteId', '==', docIdRealSiExiste).get(); cs.forEach(d => { batch.update(d.ref, { pacienteId: elegido.id }); });
            const as = await db.collection('apuntes').where('pacienteId', '==', docIdRealSiExiste).get(); as.forEach(d => { batch.update(d.ref, { pacienteId: elegido.id }); });
            batch.delete(db.collection('pacientes').doc(docIdRealSiExiste));
        }
        if(telefonoOrigen) {
            const ch = await db.collection('citas').where('telefono', '==', telefonoOrigen).get();
            ch.forEach(d => { const c = d.data(); if (!c.pacienteId || c.pacienteId === docIdRealSiExiste) { batch.update(d.ref, { pacienteId: elegido.id }); } });
        }
        await batch.commit(); Swal.fire('Unificado', 'Expediente consolidado con éxito.', 'success'); cargarDirectorioPacientes();
    }
}

// ==========================================
// 8. FICHA CLÍNICA (3 Pestañas)
// ==========================================
let curHistPacienteId = null;
async function abrirHistorial(pacienteId, tel, nom, nac, sex, expNum) {
    curHistPacienteId = pacienteId; document.getElementById('hist-nombre').innerText = `Expediente: ${nom}`;
    document.getElementById('hist-datos').innerHTML = `<b>Núm:</b> ${expNum || 'S/N'} &nbsp;|&nbsp; <b>Edad:</b> ${calcularEdad(nac)} &nbsp;|&nbsp; <b>Sexo:</b> ${sex}`;
    cambiarTabHistorial('apuntes'); document.getElementById('modal-historial').style.display = 'flex';
}

function cambiarTabHistorial(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`btn-tab-${tabId}`).classList.add('active'); document.getElementById(`tab-${tabId}`).classList.add('active');
    if(tabId === 'apuntes') cargarApuntesMedicos(); if(tabId === 'signos' || tabId === 'recetas') cargarFichaClinica();
}

async function cargarApuntesMedicos() {
    const lista = document.getElementById('lista-apuntes-historial'); lista.innerHTML = 'Cargando notas...';
    const snap = await db.collection('apuntes').where('pacienteId', '==', curHistPacienteId).get();
    if(snap.empty) { lista.innerHTML = '<p style="color:var(--muted);">No hay notas médicas.</p>'; return; }
    let arr = snap.docs.map(d => d.data()); arr.sort((a,b) => (b.fecha?.toDate() || new Date()) - (a.fecha?.toDate() || new Date()));
    let html = ''; arr.forEach(data => {
        const dateStr = data.fecha ? data.fecha.toDate().toLocaleString('es-ES', {dateStyle: 'medium', timeStyle: 'short'}) : 'Reciente';
        html += `<div style="padding:15px; border-left:4px solid var(--primary); background:#f8fafc; margin-bottom:10px; border-radius:4px;"><small style="color:var(--primary-dark); font-weight:bold;">${dateStr}</small><br><div style="font-size:14px; margin-top:5px; white-space:pre-wrap;">${data.texto}</div></div>`;
    });
    lista.innerHTML = html;
}

async function guardarApunteMedico(e) { e.preventDefault(); const texto = document.getElementById('nuevo-apunte').value; await db.collection('apuntes').add({ pacienteId: curHistPacienteId, texto: texto, fecha: firebase.firestore.FieldValue.serverTimestamp() }); document.getElementById('nuevo-apunte').value = ''; cargarApuntesMedicos(); }

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
            
            if(c.diagnostico) { 
                // SOLUCIÓN: Limpiar saltos de línea para que el código HTML del botón no se rompa al reimprimir recetas generadas.
                const safeNom = c.nombre ? c.nombre.replace(/'/g,"\\'") : '';
                const safeDiag = c.diagnostico ? c.diagnostico.replace(/'/g,"\\'").replace(/\n/g,"\\n").replace(/\r/g,"") : '';
                const safeRec = c.receta ? c.receta.replace(/'/g,"\\'").replace(/\n/g,"\\n").replace(/\r/g,"") : '';

                htmlRecetas += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><div style="font-size:13px;"><b>${f}</b><br><span style="color:var(--muted);">${c.diagnostico}</span></div><button onclick="generarPDF('${safeNom}','${safeDiag}', '${safeRec}', '${c.fecha}', '')" class="btn-secondary" style="width:auto; padding:5px 10px; font-size:11px;">🖨️ Imprimir</button></div>`; 
            }
        });
    }
    document.getElementById('lista-signos-historial').innerHTML = htmlSignos || '<p style="color:var(--muted);">No hay registro de signos vitales.</p>';
    document.getElementById('lista-recetas-historial').innerHTML = htmlRecetas || '<p style="color:var(--muted);">No hay recetas previas.</p>';
}

// ==========================================
// 9. AGENDA (CALENDARIO COMPLETO)
// ==========================================
let fechaNav = new Date(); let fechaSeleccionada = null; let citasDelMes = []; let bloqueosDelMes = [];
function cambiarMes(delta) { fechaNav.setMonth(fechaNav.getMonth() + delta); cargarDatosCalendario(); }
async function cargarDatosCalendario() { const year = fechaNav.getFullYear(), month = fechaNav.getMonth(); const p = `${year}-${String(month + 1).padStart(2, '0')}-01`, u = `${year}-${String(month + 1).padStart(2, '0')}-31`; const cSnap = await db.collection('citas').where('fecha', '>=', p).where('fecha', '<=', u).get(); citasDelMes = cSnap.docs.map(d => d.data()); const bSnap = await db.collection('bloqueos').where('fecha', '>=', p).where('fecha', '<=', u).get(); bloqueosDelMes = bSnap.docs.map(d => d.data()); dibujarCalendario(); }
function dibujarCalendario() { const year = fechaNav.getFullYear(), month = fechaNav.getMonth(); document.getElementById('mes-actual').innerText = fechaNav.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); const grid = document.getElementById('calendario-body'); grid.innerHTML = ''; const p = new Date(year, month, 1).getDay(), d = new Date(year, month + 1, 0).getDate(); for (let i = 0; i < p; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'dia-celda vacio'})); for (let i = 1; i <= d; i++) { const s = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`, div = document.createElement('div'); div.className = 'dia-celda'; div.innerText = i; if (s === new Date().toISOString().split('T')[0]) div.classList.add('hoy'); if (s === fechaSeleccionada) div.classList.add('seleccionado'); if (citasDelMes.some(c => c.fecha === s)) div.appendChild(Object.assign(document.createElement('div'), {className: 'dot-cita'})); if (bloqueosDelMes.some(b => b.fecha === s && b.horas.length >= 10)) div.classList.add('bloqueado'); div.onclick = () => seleccionarDiaCalendario(s, i, citasDelMes.filter(c => c.fecha === s), bloqueosDelMes.find(b => b.fecha === s)); grid.appendChild(div); } }
function seleccionarDiaCalendario(s, i, c, b) { fechaSeleccionada = s; dibujarCalendario(); document.getElementById('dia-detalle-titulo').innerText = new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); const p = document.getElementById('panel-citas-dia'); p.innerHTML = c.length ? c.map(x => `<div style="font-size:13px;border-bottom:1px solid #eee;padding:5px;"><b>${x.hora}</b> - ${x.nombre}</div>`).join('') : 'Sin citas'; if (currentUserRole === 'doctor') { document.getElementById('panel-bloqueos').style.display = 'block'; dibujarHorasBloqueo(b ? b.horas : []); } }

const TODAS_LAS_HORAS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"];
function dibujarHorasBloqueo(b) { const c = document.getElementById('lista-horas-bloqueo'); c.innerHTML = TODAS_LAS_HORAS.map(h => `<button class="hora-btn ${b?.includes(h) ? 'bloqueada' : ''}" onclick="this.classList.toggle('bloqueada')">${h}</button>`).join(''); }

function bloquearTodoElDia() {
    const botones = document.querySelectorAll('.hora-btn');
    const todosBloqueados = Array.from(botones).every(b => b.classList.contains('bloqueada'));
    if(todosBloqueados) { botones.forEach(b => b.classList.remove('bloqueada')); }
    else { botones.forEach(b => b.classList.add('bloqueada')); }
    guardarBloqueosDia(); 
}

async function guardarBloqueosDia() { const h = Array.from(document.querySelectorAll('.hora-btn.bloqueada')).map(x => x.innerText); try { if (!h.length) await db.collection('bloqueos').doc(fechaSeleccionada).delete(); else await db.collection('bloqueos').doc(fechaSeleccionada).set({ fecha: fechaSeleccionada, horas: h }); Swal.fire('Ok', 'Agenda actualizada', 'success'); cargarDatosCalendario(); } catch(e) {} }