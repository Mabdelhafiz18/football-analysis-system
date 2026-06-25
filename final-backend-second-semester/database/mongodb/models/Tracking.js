import mongoose from 'mongoose';

const TrackingSchema = new mongoose.Schema({
    match_id: { type: Number, required: true, index: true },
    timestamp: { type: Number, required: true }, // Frame timestamp in seconds
    t: { type: Number }, // Alias for timestamp (frontend compatibility)
    frame_number: { type: Number, required: true },
    frame: { type: Number }, // Alias for frame_number (frontend compatibility)

    players: [{
        player_id: Number,
        team: { type: String, enum: ['home', 'away'] },
        number: Number,
        x: Number,
        y: Number,
        speed: Number,
        direction: Number,
        bbox: [Number] // Bounding box [x1, y1, x2, y2] for video overlay
    }],

    ball: {
        x: Number,
        y: Number,
        z: Number,
        speed: Number
    }
}, { timestamps: true });

// Compound index for efficient querying
TrackingSchema.index({ match_id: 1, timestamp: 1 });

const Tracking = mongoose.model('Tracking', TrackingSchema);
export default Tracking;
