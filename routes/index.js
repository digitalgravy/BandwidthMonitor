
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Sky Bandwidth Monitor', onedayaverage: '1039' });
};