import mongoose from 'mongoose';

const TacticalSchema = new mongoose.Schema({
    match_id: { type: Number, required: true, unique: true },

    formation: {
        home: String, // e.g., "4-3-3"
        away: String
    },

    team_heatmap: {
        grid_w: Number,
        grid_h: Number,
        home: [[Number]], // 2D array of intensity
        away: [[Number]]
    },

    pass_network: {
        nodes: [{
            id: Number, // Player number
            x: Number,
            y: Number,
            team: String,
            count: Number // Total passes
        }],
        edges: [{
            from: Number,
            to: Number,
            count: Number
        }]
    },

    possession_timeline: {
        home: [Number],
        away: [Number]
    }
}, { timestamps: true });

const Tactical = mongoose.model('Tactical', TacticalSchema);
export default Tactical;
