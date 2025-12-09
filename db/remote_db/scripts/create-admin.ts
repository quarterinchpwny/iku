// db/remote_db/scripts/create-admin.ts
import { execSync } from 'child_process';
import { hashPassword } from '../src/auth/password';
import minimist from 'minimist';

async function main() {
  const args = minimist(process.argv.slice(2));

  const username = args.username;
  const password = args.password;
  const dbName = args.db || 'RouteDB';
  const isRemote = args.remote === true;

  if (!username || !password) {
    console.error('Usage: tsx scripts/create-admin.ts --username <username> --password <password> [--remote]');
    process.exit(1);
  }

  if (password.length < 6) {
      console.error('Error: Password must be at least 6 characters long.');
      process.exit(1);
  }

  const environment = isRemote ? 'remote' : 'local';
  console.log(`Targeting ${environment} database "${dbName}"...`);
  
  // 1. Check if user already exists
  try {
    const checkSql = `SELECT id FROM users WHERE username = '${username}'`;
    let checkCommand = `wrangler d1 execute ${dbName} --json --command "${checkSql}"`;
    checkCommand += isRemote ? ' --remote' : ' --local';
    
    console.log('Checking if user exists...');
    const checkOutput = execSync(checkCommand).toString();
    
    // Wrangler's --json output is an array of results for each statement.
    // We only have one statement, so we check the first item.
    const checkResult = JSON.parse(checkOutput);

    if (checkResult[0]?.results?.length > 0) {
      console.error(`❌ Error: User "${username}" already exists.`);
      process.exit(1);
    }
    console.log(`User "${username}" does not exist. Proceeding with creation.`);
  } catch (error) {
     console.error('❌ Error occurred while checking for existing user.');
     console.error('Please ensure your database is set up and migrations have been run.');
     console.error('Wrangler error details:', error);
     process.exit(1);
  }

  // 2. If user does not exist, create them
  console.log(`Creating admin user "${username}"...`);
  try {
    const hashedPassword = await hashPassword(password);
    const insertSql = `INSERT INTO users (username, password, role) VALUES ('${username}', '${hashedPassword}', 'admin');`;

    let insertCommand = `wrangler d1 execute ${dbName} --command "${insertSql}"`;
    insertCommand += isRemote ? ' --remote' : ' --local';

    console.log('Executing INSERT command...');
    const output = execSync(insertCommand).toString();

    console.log('\n', output);
    console.log(`✅ Successfully created admin user "${username}".`);

  } catch (error) {
    console.error('❌ Failed to create admin user.');
    if (error instanceof Error) {
        const err = error as any;
        console.error('Error Message:', err.message);
        console.error('Stderr:', err.stderr?.toString());
    } else {
        console.error(error);
    }
    process.exit(1);
  }
}

main();