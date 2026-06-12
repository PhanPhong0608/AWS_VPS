const mysql = require('mysql2/promise');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

exports.handler = async (event) => {
    console.log("Starting daily VPS expiry check...");

    const connection = await mysql.createConnection({
        host: process.env.RDS_HOSTNAME,
        port: process.env.RDS_PORT ? parseInt(process.env.RDS_PORT) : 3306,
        user: process.env.RDS_USERNAME,
        password: process.env.RDS_PASSWORD,
        database: process.env.RDS_DBNAME
    });

    try {
        // Query VPS instances expiring in the next 3 days and are not terminated
        const query = `
            SELECT v.id, v.name as vps_name, v.expiry_date, u.email, u.username 
            FROM vps_instances v
            JOIN users u ON v.user_id = u.id
            WHERE v.expiry_date <= DATE_ADD(NOW(), INTERVAL 3 DAY)
              AND v.status != 'TERMINATED'
        `;
        
        const [rows] = await connection.execute(query);
        console.log(`Found ${rows.length} expiring VPS instances.`);

        for (const row of rows) {
            const message = `Dear ${row.username},\n\nYour VPS instance "${row.vps_name}" (ID: ${row.id}) is set to expire on ${row.expiry_date}.\n\nPlease ensure your wallet balance is sufficient for renewal to avoid system termination.\n\nBest regards,\nAWS VPS Rental Platform`;
            
            const publishParams = {
                TopicArn: process.env.SNS_TOPIC_ARN,
                Message: message,
                Subject: `Action Required: VPS "${row.vps_name}" Expiring Soon`,
                MessageAttributes: {
                    'email': {
                        DataType: 'String',
                        StringValue: row.email
                    }
                }
            };
            
            const command = new PublishCommand(publishParams);
            await snsClient.send(command);
            console.log(`Sent SNS expiration alert for VPS ID: ${row.id} to ${row.email}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: `Expiry check completed. Notifications sent: ${rows.length}` 
            })
        };
    } catch (err) {
        console.error("Error running VPS expiry scanner:", err);
        throw err;
    } finally {
        await connection.end();
    }
};
