import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { CLIENTIFY_API_KEY, UTIO_API_KEY, UTIO_CHATS_URL } from "./env.js";
import {
    getUserByPhoneClientify,
    createClientifyNote,
    assignChat,
    updateContactName
} from './functions.js';

const app = express();

app.use(express.json());
app.use(cors());

/**
 * Webhook para la autoasignación de chats.
 */
app.post("/utio-chat", async (req, res) => {
    try {
        // Obtención del número de teléfono, el nombre del contacto y el id del propietario si tiene
        const { data } = req.body;
        const { chat, fromNumber } = data;
        const phoneNumber = fromNumber.replace("+34", "");
        const ownerAgentId = chat.owner.agent;

        // Si no tiene propietario se asigna uno en función de si existe en clientify o no.
        if (!ownerAgentId) {
            // Si no tiene propietario, se consulta en Clientify
            const contactData = await getUserByPhoneClientify(phoneNumber);

            // Asignación del chat según cantidad de registros encontrados
            if (contactData.count === 0 || contactData === null || contactData === undefined) {
                await assignChat(phoneNumber, 'info@npro.es'); // Cliente no registrado
            } else {
                // Si hay mas de un contacto no le ponemos nombre. 
                await assignChat(phoneNumber, 'vi@npro.es'); // Cliente profesional
                const ownerName = contactData.count > 1 ? 'Num. Repetido' : (contactData.results[0].owner_name);
                const firstName = contactData.results[0].first_name;
                await updateContactName(phoneNumber, firstName, ownerName);
            }

            return res.status(200).json({ message: "Contacto asignado correctamente." });
        }

        // Si tiene propietario avisamos a VI a través de Inbox con un mensaje personalizado.
        const teamUrl = `https://whatsapp-api.utio.io/v1/team`;
        const teamResponse = await fetch(teamUrl, {
            method: 'GET',
            headers: { 'Authorization': `Token ${UTIO_API_KEY}` }
        });
        if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            const owner = teamData.find(member => member.id === ownerAgentId);

            // Solo notificar si el propietario es de Venta Interna 
            if (owner?.initials === "VI") {
                const response = await getUserByPhoneClientify(phoneNumber);
                const data = response.results[0];
                // Obtener el nombre del contacto y del propietario para enviarlo junto al mensaje.
                const contactFirstName = data.first_name;
                const contactSecondName = data.last_name;
                const ownerName = data.owner_name;

                updateContactName(phoneNumber, contactFirstName, ownerName);

                const clientMessage = `
                ☝️☝️☝️
                Para recibir una mejor atención, por favor, pulse sobre el contacto de atención a profesionales
                `
                // Autorespuesta al recibir un mensaje
                await fetch('https://whatsapp-api.utio.io/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Token': UTIO_API_KEY
                    },
                    body: JSON.stringify({ phone: fromNumber, message: clientMessage })
                })
       
                // Enviar notificación al equipo
                const message = `Nuevo mensaje de ${contactFirstName} ${contactSecondName} de ${ownerName} (${fromNumber}). Revisa Utio: https://whatsapp.utio.io/${UTIO_CHATS_URL}/c/+34${phoneNumber}`;

                await fetch('https://whatsapp-api.utio.io/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${UTIO_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ phone: '+34621415478', message, contacts: [{phone: '+34621415478', name: 'Npro profesional'}] })
                });

                // Enviar el contacto
                await fetch('https://whatsapp-api.utio.io/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Token': UTIO_API_KEY
                    },
                    body: JSON.stringify({
                         phone: JSON.stringify({ phone: fromNumber }),
                        contacts: [{phone: '+34621415478', name: 'Npro profesional'}]
                    })
                })
            }
        }
        const date = new Date();
        const day = date.getDate();
        const hour = date.getHours();
        const month = date.getMonth();
        const minute = date.getMinutes();
        console.log(`Fecha: ${day}/${month + 1} ${hour}:${minute}. Proceso: Utio webhook asignación contactos.`)
        return res.status(200).send("Webhook procesado correctamente");
    } catch (error) {
        console.error("Error en /utio-chat:", error);
        if (!res.headersSent) res.status(500).send("Error interno en el webhook.");
    }
});

/**
 * Enviar mensaje a un usuario por WhatsApp.
 */
app.post('/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) return res.status(400).json({ error: 'Teléfono y mensaje requeridos.' });

        // Enviar mensaje vía API de Utio
        const response = await fetch('https://whatsapp-api.utio.io/v1/messages', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${UTIO_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone, message })
        });

        if (!response.ok) {
            console.error(`Error enviando mensaje: ${response.statusText}`);
            return res.status(500).json({ error: 'Error al enviar el mensaje.' });
        }

        // Registrar nota en Clientify
        const contactResponse = await getUserByPhoneClientify(phone);
        if (contactResponse.results) {
            for (const contact of contactResponse.results) {
                await createClientifyNote(contact.id, "Conversación iniciada por Whatsapp", message);
            }
        }

        res.status(200).json(await response.json());
    } catch (error) {
        console.error("Error en /send-message:", error);
        res.status(500).json({ error: 'Error enviando el mensaje' });
    }
});

app.listen(3000, () => console.log("Servidor en http://localhost:3000"));
