var 
	path = require('path'),
	fs = require('fs');

var Setup = new function(){

	// Try load in game settings
	var loadGameConfigs = function(callback){
        // make a copy of gameconfig for clients
		this.globals.gameConfig = loadJSONSafe('../server/mafia.config.raw.js');
		this.globals.namingConventions = loadJSONSafe('../server/mafia.names.raw.js');
		this.globals.gameLogic = require('../server/mafia.gamelogic.js').getGameLogic();
        this.globals.gameConfigString = JSON.stringify(this.globals.gameConfig, false, 4);
		callback.call();
	}
    
    var generateClientFiles = function(callback)
    {
        var generatedConfig = JSON.stringify(this.globals.gameConfig, false, 4);
        var filename = path.resolve(__dirname, this.constants.FILE_GENERATED_DIR+"mafia.config.js");
        try
        {
            fs.writeFileSync(filename, generatedConfig);
        }
        catch (er)
        {
            console.error("\n\nファイルの書き出しに失敗 '{0}' error '{1}'.\n\n".replace("{0}", filename).replace("{1}", er));
        }
        callback.call();
    }
	
	var generateUserSettingsStructure = function(){
		var menuSkinList = [{"name":"Use Mafia Default","value":""}],gameSkinList = [{"name":"Use Game Settings","value":""}], langSkinList=[];
		this.globals.menuSkins.forEach(function(el, indx, ar){menuSkinList.push({"name":el.name,"value":el.id});});
		this.globals.gameSkins.forEach(function(el, indx, ar){gameSkinList.push({"name":el.name,"value":el.id});});
		this.globals.languageSkins.forEach(function(el, indx, ar){langSkinList.push({"name":el,"value":el});});		
		var binarySwitchList = [{'name':'Off','value':'off'}, {'name':'On','value':'on'}];
		
		this.globals.userSettingSetupStructure = {
			'groups':[
				{'id':'misc','display':'その他'},
				{'id':'skins','display':'外観'},
				{'id':'ui','display':'インターフェース'}
			],
			'settings':[
				{'id':'csetting_game_volume', 'type':'number', 'details':'ゲーム音量', 'group':'misc', 'defaultvalue':'50'},
				{'id':'csetting_language', 'type':'dropdown', 'details':'言語', 'group':'misc', 'selection':langSkinList, 'defaultvalue':'english'},                
				{'id':'csetting_menu_skin', 'type':'dropdown', 'details':'メニュー装飾', 'group':'skins', 'selection':menuSkinList, 'triggerReload':true,
					'warning':"「メニュー装飾」を変更すると、ゲームが再読み込みされます。"},
				{'id':'csetting_menu_skin_custom', 'details':'カスタムメニュー装飾URL', 'group':'skins', 'triggerReload':true,
					'warning':"「カスタムメニュー装飾URL」を設定すると、ブラウザ制御が外部ベンダーに委ねられます。これは上級ユーザーまたは開発者にのみ推奨されます。また、ゲームが再読み込みされます。"},
				{'id':'csetting_game_skin', 'type':'dropdown', 'details':'ゲーム装飾', 'group':'skins', 'selection':gameSkinList,
					'warning':"「ゲーム装飾」を変更すると、参加しているゲームサーバーの設定を上書きします。"},
				{'id':'csetting_game_skin_custom', 'details':'カスタムゲーム装飾URL', 'group':'skins',
					'warning':"「カスタムゲーム装飾URL」を設定すると、ブラウザ制御が外部ベンダーに委ねられます。これは上級ユーザーまたは開発者にのみ推奨されます。また、参加しているゲームサーバーの設定を上書きします。"},                    
				{'id':'csetting_game_animation', 'type':'dropdown', 'details':'CSSアニメーション', 'group':'ui', 'defaultvalue':'on', 'selection':binarySwitchList},
				{'id':'csetting_game_fontsize', 'details':'チャット文字サイズ', 'group':'ui', 'defaultvalue':'14px'},
				{'id':'csetting_game_chat_x', 'type':'number', 'details':'チャットボックス位置', 'group':'ui', 'defaultvalue':'0'},
				{'id':'csetting_game_players_x', 'type':'number', 'details':'プレイヤーリスト位置', 'group':'ui', 'defaultvalue':'0'},
				{'id':'csetting_game_help_pos', 'type':'string', 'details':'ヘルプボックス位置', 'group':'ui', 'defaultvalue':'0,0'},
				{'id':'csetting_game_help_size', 'type':'string', 'details':'ヘルプボックスサイズ', 'group':'ui', 'defaultvalue':'500,600'}
			]
		};
		var userSettingKeys = [];
		this.globals.userSettingSetupStructure.settings.forEach(function(el, indx, ar){
			userSettingKeys.push(el.id);
		});
		this.globals.userSettingKeys = userSettingKeys;
	}
	
	var generateGameSettingsStructure = function(){
		var 
			gameSkinOptions,
			namingThemeOptions,
			roleSelectionOptions,
			phaseTimeValues = {};
            
        gameSkinOptions = this.globals.gameSkins
            .map(function(gskin){return {'display':gskin.name,'value':gskin.id};});
        namingThemeOptions = this.globals.namingConventions
            .map(function(ntheme){return {'display':ntheme.displayname,'value':ntheme.id};});
        roleSelectionOptions =  Array.prototype.concat.apply([], [
            this.globals.gameConfig.randomroles
                .map(function(role){return {'display':role.displayid,'value':'rand_'+role.randomroleid};}),
            this.globals.gameConfig.roles
                .map(function(role){return {'display':role.displayid,'value':'role_'+role.roleid};})
        ]);
            
		this.constants.MAFIA_PHASE_TIMES_DEFAULTS.forEach(function(phasetime, i){phaseTimeValues[i] = phasetime;});		
		this.globals.gameSettingSetupStructure = {
			// Settings            
            // DEFAULTS are setup in gameclient.
			'settings':[
				{'id':'ssetting_gamename', 'display':'ゲーム名', 'type':'text' },
				{'id':'ssetting_roleselection', 'display':'役割選択', 'type':'list', 'frontdisplay':true, 'options':roleSelectionOptions },
				{'id':'ssetting_maxplayers', 'display':'最大人数', 'type':'number', 'frontdisplay':true },
				{'id':'ssetting_gameskin', 'display':'Game skin', 'type':'dropdown', 'frontdisplay':true, 'options':gameSkinOptions },
				{'id':'ssetting_phasetimes', 'display':'フェーズの時間制限', 'type':'tree',
					'values':phaseTimeValues,
					'schema':[
						{'id':'0','display':'アクションフェーズ（夜）'},
						{'id':'1','display':'アクション結果フェーズ（夜）'},
						{'id':'2','display':'議論フェーズ（昼）'},
						{'id':'3','display':'裁判フェーズ（昼）'},
						{'id':'4','display':'弁護フェーズ（昼）'},
						{'id':'5','display':'投票フェーズ（昼）'},
						{'id':'6','display':'投票結果フェーズ（昼）'},
						{'id':'7','display':'黄昏フェーズ（昼）'}
					]
				},
				{'id':'ssetting_namingtheme', 'display':'ネーミングテーマ', 'type':'dropdown', 'frontdisplay':true, 'options':namingThemeOptions },
				{'id':'ssetting_pretime', 'display':'名前選択の制限時間', 'type':'text' },
				{'id':'ssetting_graveyardroles', 'display':'死亡プレイヤーの役職表示', 'type':'dropdown', 'frontdisplay':true, 
					'options':[
						{'display':'表示する','value':'true'},
						{'display':'非表示','value':'false'}
					]
				}
			],
			// Setting validation (apart from automatic list, dropdown etc)
			'setting_validators':{
				'ssetting_maxplayers':function(val){
					var result = {valid:true,error:''};
					if(parseInt(val) <= 0){
						result.valid = false;
						result.error = "Game cannot have a player limit below 1.";
					}
					return result;
				},
				'ssetting_gamename':function(val){
					var result = {valid:true,error:''};
					if(!val.length || val.length < 4 || val.length > 24){
						result.valid = false;
						result.error = "Not a valid game name, must be between 4 and 24 characters.";
					}
					return result;
				},
				'ssetting_phasetimes':function(val){
					var result = {valid:true,error:''};
					for(var key in val){
						var num = parseInt(val[key]);
						if(isNaN(num)){
							result.valid = false;
							result.error = "Not a valid number used in phasetime.";
							break;
						}
						if(num < 4000){
							result.valid = false;
							result.error = "Times must be longer then 4000ms otherwise this can negatively affect game flow.";
							break;
						}
					}
					return result;
				},
				'ssetting_pretime':function(val){
					var result = {valid:true,error:''};
					var timelimit = parseInt(val);
					if(isNaN(timelimit)){
						result.valid = false;
						result.error = "Name Choice time limit must be a number.";
					}
					if(timelimit < 0){
						result.valid = false;
						result.error = "Name Choice time limit must be at least 0ms.";
					}
					return result;
				}
			},
			// For converting structure to be appropriate for db
			'setting_parsers':{
				'ssetting_phasetimes':function(val){
					if(Array.isArray(val)){
						var obj = {};
						val.forEach(function(v, i){
							obj[i] = parseInt(v);
						});
						val = JSON.stringify(obj);
					} else if(typeof val == 'object'){
						var obj = {};
						for(var i in val){
							obj[i] = parseInt(val[i]);
						}
						val = JSON.stringify(obj);
					}
					return val;
				},
				'ssetting_pretime':function(val){
					return parseInt(val);
				}
			}
		};
	}
	
	var updateSkinLists = function(callback){	
		var 
			_this = this,
			menuDir = 'client/skins/menu/',
			gameDir = 'client/skins/game/',
			langDir = 'client/languages/',
			menuDirs = fs.readdirSync(menuDir),
			gameDirs = fs.readdirSync(gameDir),
			skinfiles,
			data,
			infojson;
			
		this.globals.languageSkins = fs.readdirSync(langDir);
		var menuSkins = [], gameSkins = [];
			
		for(var i=0;i<menuDirs.length;i++){
			skinfiles = fs.readdirSync(menuDir+menuDirs[i]);
			if(skinfiles.indexOf('info.json') != -1){		
				data = fs.readFileSync(menuDir+menuDirs[i]+'/info.json');
				infojson = JSON.parse(data.toString());
				if(_this.constants.DEFAULT_MAFIA_SKINS.menu == infojson.id)menuSkins.unshift(infojson);
				else menuSkins.push(infojson);
			} else {
				this.log('Warning: Skin ('+menuDirs[i]+') missing script, style or preview.', this.loglevel.IMPORTANT);
			}
		}
		for(var i=0;i<gameDirs.length;i++){
			skinfiles = fs.readdirSync(gameDir+gameDirs[i]);
			if(skinfiles.indexOf('info.json') != -1){
				data = fs.readFileSync(gameDir+gameDirs[i]+'/info.json');
				infojson = JSON.parse(data.toString());
				if(_this.constants.DEFAULT_MAFIA_SKINS.game == infojson.id)gameSkins.unshift(infojson);
				else gameSkins.push(infojson);
			} else {
				this.log('Warning: Skin ('+gameDirs[i]+') missing script, style or preview.', this.loglevel.IMPORTANT);
			}
		}
		
		this.globals.menuSkins = menuSkins;
		this.globals.gameSkins = gameSkins;
		
		generateUserSettingsStructure.call(this);
		generateGameSettingsStructure.call(this);
		
		callback.call();
	}
    
    // This is to load JSON that includes comments, and strip them out before parsing.
    var loadJSONSafe = function(filename) {
        try
        {
            var json = fs.readFileSync(path.resolve(__dirname, filename)).toString();
        }
        catch (er)
        {
            console.error("\n\nファイルの読み込みに失敗しました '{0}' error '{1}'.\n\n".replace("{0}", filename).replace("{1}", er));
        }
		var tokenizer = /"|(\/\*)|(\*\/)|(\/\/)|\n|\r/g,
			in_string = false,
			in_multiline_comment = false,
			in_singleline_comment = false,
			tmp, tmp2, new_str = [], ns = 0, from = 0, lc, rc;		
		tokenizer.lastIndex = 0;		
		while (tmp = tokenizer.exec(json)) {
			lc = RegExp.leftContext;
			rc = RegExp.rightContext;
			if (!in_multiline_comment && !in_singleline_comment) {
				tmp2 = lc.substring(from);
				if (!in_string) {
					tmp2 = tmp2.replace(/(\n|\r|\s)*/g,"");
				}
				new_str[ns++] = tmp2;
			}
			from = tokenizer.lastIndex;			
			if (tmp[0] == "\"" && !in_multiline_comment && !in_singleline_comment) {
				tmp2 = lc.match(/(\\)*$/);
				if (!in_string || !tmp2 || (tmp2[0].length % 2) == 0) {	// start of string with ", or unescaped " character found to end string
					in_string = !in_string;
				}
				from--; // include " character in next catch
				rc = json.substring(from);
			}
			else if (tmp[0] == "/*" && !in_string && !in_multiline_comment && !in_singleline_comment) {
				in_multiline_comment = true;
			}
			else if (tmp[0] == "*/" && !in_string && in_multiline_comment && !in_singleline_comment) {
				in_multiline_comment = false;
			}
			else if (tmp[0] == "//" && !in_string && !in_multiline_comment && !in_singleline_comment) {
				in_singleline_comment = true;
			}
			else if ((tmp[0] == "\n" || tmp[0] == "\r") && !in_string && !in_multiline_comment && in_singleline_comment) {
				in_singleline_comment = false;
			}
			else if (!in_multiline_comment && !in_singleline_comment && !(/\n|\r|\s/.test(tmp[0]))) {
				new_str[ns++] = tmp[0];
			}
		}
		new_str[ns++] = rc;
        new_str = new_str.join("");
        var jsonObj = {};
        try
        {
            jsonObj = JSON.parse(new_str);
        }
        catch(er)
        {
            console.error("\n\nファイル内のJSONの解析に失敗しました。 '{0}' error '{1}'.\n\n".replace("{0}", filename).replace("{1}", er));
        }        
		return jsonObj;
	}

	this.setupMafia = function(maf, callback){		
		// Load Game Settings
		loadGameConfigs.call(maf, function(){
            updateSkinLists.call(maf, function(){				
                callback.call();				
            });
		});
	}
}();

module.exports = Setup;