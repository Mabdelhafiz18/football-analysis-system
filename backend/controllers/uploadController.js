export const uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

    const { homeTeam, awayTeam, date, league } = req.body;
    
    // In a real scenario, we would trigger AI processing here
    // and save the initial match record to PostgreSQL.

    res.json({
      message: 'Video uploaded successfully',
      filename: req.file.filename,
      match_info: { homeTeam, awayTeam, date, league }
    });
  } catch (err) {
    next(err);
  }
};

