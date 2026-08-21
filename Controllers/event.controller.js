const Event = require('../Models/event.model');

/**
 * GET /api/event/get?from=ISO&to=ISO
 * Returns calendar entries, optionally limited to a date window.
 * The dashboard calendar sends the visible month as from/to.
 */
exports.getAllEvents = async (req, res) => {
    try {
        const filter = {};
        const { from, to } = req.query || {};

        if (from || to) {
            filter.startDate = {};
            if (from) filter.startDate.$gte = new Date(from);
            if (to) filter.startDate.$lte = new Date(to);
        }

        const events = await Event.find(filter).sort({ startDate: 1 });
        res.status(200).send({ message: 'Events fetched', data: events });
    } catch (e) {
        res.status(500).send({ message: 'Error fetching events', error: e.message });
    }
};

/** POST /api/event/add   (ADMIN only) */
exports.addEvent = async (req, res) => {
    try {
        const b = req.body || {};

        const title = String(b.title || '').trim();
        if (!title) return res.status(400).send({ message: 'Title is required' });
        if (!b.startDate) return res.status(400).send({ message: 'Start date is required' });

        const startDate = new Date(b.startDate);
        if (Number.isNaN(startDate.getTime())) {
            return res.status(400).send({ message: 'Start date is not a valid date' });
        }

        let endDate;
        if (b.endDate) {
            endDate = new Date(b.endDate);
            if (Number.isNaN(endDate.getTime())) {
                return res.status(400).send({ message: 'End date is not a valid date' });
            }
            if (endDate < startDate) {
                return res.status(400).send({ message: 'End date cannot be before the start date' });
            }
        }

        const type = String(b.type || 'EVENT').toUpperCase();
        if (!Event.EVENT_TYPES.includes(type)) {
            return res.status(400).send({
                message: `type must be one of: ${Event.EVENT_TYPES.join(', ')}`
            });
        }

        const event = await Event.create({
            title,
            description: String(b.description || '').trim(),
            type,
            startDate,
            endDate,
            location: String(b.location || '').trim(),
            createdBy: req.auth?.id,
        });

        res.status(201).send({ message: 'Event added to the calendar', data: event });
    } catch (e) {
        if (e.name === 'ValidationError') {
            return res.status(400).send({ message: e.message });
        }
        res.status(500).send({ message: 'Error adding event', error: e.message });
    }
};

/** DELETE /api/event/:id   (ADMIN only) */
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).send({ message: 'Event not found' });
        res.status(200).send({ message: 'Event removed', data: event });
    } catch (e) {
        res.status(500).send({ message: 'Error removing event', error: e.message });
    }
};
