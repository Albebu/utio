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
        const { data } = req.body;
        const { chat, fromNumber } = data;
        const phoneNumber = fromNumber.replace("+34", "");
        const contactName = chat.name;
        const ownerAgentId = chat.owner.agent;

        if (ownerAgentId) {
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
                    const contact = await getUserByPhoneClientify(phoneNumber);
                    const ownerName = contact.results[0]?.owner_name;

                    // Enviar notificación al equipo
                    const message = `Nuevo mensaje de ${contact.first_name} ${contact.last_name} de ${ownerName} (${fromNumber}). Revisa Utio: https://whatsapp.utio.io/${UTIO_CHATS_URL}/c/+34${phoneNumber}`;

                    await fetch('https://whatsapp-api.utio.io/v1/messages', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Token ${UTIO_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ phone: '+34621415478', message })
                    });
                }
            }
        } else {
            // Si no tiene propietario, se consulta en Clientify
            const contactData = await getUserByPhoneClientify(phoneNumber);

            // Asignación del chat según cantidad de registros encontrados
            if (contactData.count === 0 || contactData === null || contactData === undefined) {
                await assignChat(phoneNumber, 'info@npro.es'); // Cliente no registrado
            } else {
                await assignChat(phoneNumber, 'vi@npro.es'); // Cliente profesional
                const ownerName = contactData.count > 1 ? 'Num. Repetido' : (contactData.results[0].owner_name);
                await updateContactName(phoneNumber, contactName, ownerName);
            }

        }

        res.status(200).send("Webhook procesado correctamente");
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
